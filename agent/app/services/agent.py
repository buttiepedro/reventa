"""The conversation loop: one inbound turn in, one WhatsApp reply out."""

import base64
import json
import logging
import uuid
from datetime import datetime, timezone

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.conversation import Conversation
from app.services import actions
from app.services import tools as tool_catalog
from app.services.stockar import StockarClient, StockarError

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Sos el asistente de Stockar, la plataforma donde las agencias de autos \
de Argentina comparten stock entre ellas. Hablás por WhatsApp con un usuario de una agencia.

Contexto del usuario:
{perfil}

Cómo trabajás:
- Respondés en castellano rioplatense, de vos, breve y directo. Es WhatsApp: mensajes \
cortos, sin encabezados ni markdown de documento. Listas con guiones cuando enumeres autos.
- Los datos salen SIEMPRE de las herramientas. Si no las usaste, no sabés la respuesta: \
nunca inventes precios, stock, kilómetros ni nombres de agencias.
- Los montos son pesos argentinos. "25 palos", "25 millones" y "25M" son 25000000. \
Al mostrarlos usá formato corto y legible, ej. $25.000.000.
- Los precios de la red son de reventa entre agencias, no de venta al público. Si mostrás \
los dos, aclarás cuál es cuál.
- Si una búsqueda no da resultados, decilo claro y ofrecé publicar una solicitud en La Lonja.
- Si te falta un dato para buscar bien, preguntalo en vez de asumir.

Cómo cargás un auto:
- Cuando te mandan fotos con una descripción, mirá las fotos, sacá los datos que puedas y \
normalizá marca y modelo contra el catálogo si tenés dudas.
- Nunca inventes un dato que no viste ni te dijeron. El color y los kilómetros salen de lo \
que diga el usuario o de lo que se vea claramente; si no, preguntá.
- Si el usuario no dio el precio al público, preguntáselo antes de proponer la carga.
- Llamás a proponer_carga_vehiculo, y después mostrás el resumen y preguntás si confirma.

Regla de oro sobre los cambios:
- No creás ni modificás NADA sin una confirmación explícita del usuario en su mensaje.
- proponer_* solo deja la propuesta lista. Recién confirmar_accion_pendiente la ejecuta.
- Si no estás seguro de que el usuario dijo que sí, volvé a preguntar.
- Los autos que cargás por acá quedan como pre-toma.

- Antes de tocar un auto o una oferta, buscá su id con las tools de lectura. Nunca \
inventes un id ni uses uno que el usuario no pueda reconocer: nombrá el auto por marca, \
modelo y año cuando le pidas que confirme.
- Solo podés operar sobre lo que es de la agencia del usuario. Si Stockar rechaza algo, \
contale el motivo tal cual, no lo maquilles.

Lo que no podés hacer:
- Borrar nada, dar de alta empresas o usuarios, verificar CUIT ni tocar el catálogo maestro. \
Eso se hace desde la app.
- No procesás audios ni documentos.
"""

PENDING_NOTE = """
Hay una acción pendiente de confirmación, propuesta por vos antes:
{pending}
Si el usuario la confirma en este mensaje, llamá a confirmar_accion_pendiente. Si la \
rechaza o cambia de tema, llamá a descartar_accion_pendiente.
"""


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_or_create_conversation(
    session: AsyncSession, phone_e164: str, user_id: uuid.UUID
) -> Conversation:
    conversation = await session.scalar(
        select(Conversation).where(Conversation.phone_e164 == phone_e164)
    )
    if conversation is None:
        conversation = Conversation(phone_e164=phone_e164, user_id=user_id, messages=[])
        session.add(conversation)
        await session.flush()
    elif conversation.user_id != user_id:
        # The number was re-linked to a different account: nothing from the previous
        # user's conversation, draft or photos may survive into this one.
        conversation.user_id = user_id
        conversation.messages = []
        conversation.pending_action = None
        conversation.pending_expires_at = None
        conversation.media_buffer = []
        conversation.media_buffer_at = None
    return conversation


def over_daily_limit(conversation: Conversation) -> bool:
    today = _now().date()
    if conversation.quota_date is None or conversation.quota_date.date() != today:
        conversation.quota_date = _now()
        conversation.messages_today = 0
    conversation.messages_today += 1
    return conversation.messages_today > settings.daily_message_limit


def _persistable(message: dict) -> dict:
    """Strip what must not live in stored history.

    Image payloads would bloat every later request with base64 the model already
    described in text, so they are replaced by a marker.
    """
    content = message.get("content")
    if not isinstance(content, list):
        return message
    kept = []
    for part in content:
        if part.get("type") == "image_url":
            kept.append({"type": "text", "text": "[foto enviada por el usuario]"})
            continue
        kept.append(part)
    return {**message, "content": kept}


def _user_content(text: str, images: list[tuple[bytes, str]]) -> object:
    if not images:
        return text
    parts: list[dict] = []
    for content, mime in images:
        media_type = mime if mime in {"image/jpeg", "image/png", "image/gif", "image/webp"} else "image/jpeg"
        data = base64.standard_b64encode(content).decode()
        parts.append({"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{data}"}})
    parts.append({"type": "text", "text": text or "(sin texto)"})
    return parts


def _openai_tools() -> list[dict]:
    """The catalogue is kept provider-neutral; this is the function-calling shape."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["input_schema"],
            },
        }
        for tool in tool_catalog.TOOLS
    ]


async def run_turn(
    session: AsyncSession,
    conversation: Conversation,
    user_id: uuid.UUID,
    user_text: str,
    images: list[tuple[bytes, str]] | None = None,
) -> str:
    client = StockarClient(user_id)
    try:
        profile = await client.me()
    except StockarError:
        return "No pude conectarme a Stockar en este momento. Probá de nuevo en un rato."

    perfil = (
        f"- Nombre: {profile.get('full_name')}\n"
        f"- Rol: {profile.get('role')}\n"
        f"- Agencia: {(profile.get('company') or {}).get('name', 'sin agencia')}"
    )
    system = SYSTEM_PROMPT.format(perfil=perfil)
    pending = actions.describe_pending(conversation)
    if pending:
        system += PENDING_NOTE.format(pending=pending)

    # The system prompt is rebuilt every turn (it carries the pending action), so
    # only user/assistant/tool messages are ever persisted.
    history = list(conversation.messages or [])
    history.append({"role": "user", "content": _user_content(user_text, images or [])})

    ctx = tool_catalog.ToolContext(
        client=client, session=session, conversation=conversation, user_id=user_id
    )
    openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    tools = _openai_tools()
    reply = ""

    for _ in range(settings.max_tool_iterations):
        request: dict = {
            "model": settings.agent_model,
            "max_completion_tokens": settings.agent_max_tokens,
            "messages": [{"role": "system", "content": system}, *history],
            "tools": tools,
        }
        if settings.agent_reasoning_effort:
            request["reasoning_effort"] = settings.agent_reasoning_effort

        response = await openai_client.chat.completions.create(**request)
        choice = response.choices[0]
        message = choice.message

        if getattr(message, "refusal", None):
            reply = "No puedo ayudarte con eso."
            break

        tool_calls = list(message.tool_calls or [])
        assistant: dict = {"role": "assistant", "content": message.content or ""}
        if tool_calls:
            assistant["tool_calls"] = [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {"name": call.function.name, "arguments": call.function.arguments},
                }
                for call in tool_calls
            ]
        history.append(assistant)

        if not tool_calls:
            reply = (message.content or "").strip()
            break

        for call in tool_calls:
            try:
                args = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError:
                args, output, is_error = {}, "Argumentos inválidos: no eran JSON.", True
            else:
                output, is_error = await tool_catalog.execute(call.function.name, args, ctx)
            # Function calling has no error flag: the prefix is what tells the model.
            history.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": f"ERROR: {output}" if is_error else output,
                }
            )
    else:
        logger.warning("Tool loop exhausted for user %s", user_id)
        reply = "Me quedé dando vueltas con esa consulta. ¿La podés reformular más concreta?"

    if not reply:
        reply = "No pude armar una respuesta. ¿Probamos de nuevo?"

    # Keep the window bounded, but never cut between an assistant's tool calls and
    # their results: a dangling tool_call_id is a hard API error on the next turn.
    stored = [_persistable(m) for m in history]
    conversation.messages = _trim(stored, settings.history_turns * 2)
    conversation.last_message_at = _now()
    return reply


def _trim(messages: list[dict], limit: int) -> list[dict]:
    if len(messages) <= limit:
        return messages
    start = len(messages) - limit
    # Walk forward to the first message that can open a window: a user turn.
    while start < len(messages) and messages[start]["role"] != "user":
        start += 1
    return messages[start:]
