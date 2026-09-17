"""arq worker: everything that must not happen inside Meta's request."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from arq import cron
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.redis import redis_settings as build_redis_settings
from app.models.conversation import Conversation
from app.models.inbound import InboundMessage
from app.services import agent, linking, meta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WELCOME_UNKNOWN = (
    "¡Hola! Soy el asistente de Stockar. No tengo este número asociado a ninguna cuenta.\n\n"
    "Para vincularlo, entrá a Stockar → Mi Agencia → Conectar WhatsApp y mandame acá el "
    "código de 6 dígitos que te da la app."
)
LINK_FAILED = (
    "Ese código no me sirve: puede estar vencido, ya usado o mal copiado. "
    "Generá uno nuevo desde Stockar → Mi Agencia → Conectar WhatsApp."
)
UNSUPPORTED_MEDIA = "Por ahora entiendo texto y fotos. Audios y documentos todavía no."
QUOTA_REACHED = (
    "Llegaste al límite de consultas por hoy. Seguimos mañana, o entrá a la app cuando quieras."
)
GENERIC_ERROR = "Se me complicó procesar eso. ¿Probamos de nuevo en un momento?"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def process_message(ctx: dict, meta_message_id: str) -> None:
    client = meta.MetaClient()

    async with AsyncSessionLocal() as session:
        inbound = await session.scalar(
            select(InboundMessage).where(InboundMessage.meta_message_id == meta_message_id)
        )
        if inbound is None or inbound.status != "queued":
            return
        inbound.status = "processing"
        await session.commit()

        phone = inbound.phone_e164
        try:
            reply = await _resolve_reply(ctx, session, inbound)
        except Exception as exc:  # noqa: BLE001 — one bad turn must not kill the worker
            logger.exception("Failed processing %s", meta_message_id)
            # The failure may have left the session unusable, so drop whatever the
            # turn had staged before recording the error on a clean transaction.
            await session.rollback()
            inbound = await session.scalar(
                select(InboundMessage).where(InboundMessage.meta_message_id == meta_message_id)
            )
            if inbound is not None:
                inbound.status = "error"
                inbound.error = str(exc)[:2000]
                inbound.processed_at = _now()
                await session.commit()
            await client.send_text(phone, GENERIC_ERROR)
            return

        inbound.status = "done"
        inbound.processed_at = _now()
        await session.commit()

    if reply:
        await client.send_text(phone, reply)


async def flush_media(ctx: dict, phone_e164: str) -> None:
    """Run the turn for a batch of photos the user sent without any follow-up text.

    Fires once the user has gone quiet. If a text message already consumed the
    photos, `last_message_at` has moved past them and this is a no-op.
    """
    async with AsyncSessionLocal() as session:
        conversation = await session.scalar(
            select(Conversation).where(Conversation.phone_e164 == phone_e164)
        )
        if conversation is None or not conversation.media_buffer:
            return
        if not _photos_are_unconsumed(conversation):
            return
        if conversation.media_buffer_at > _now() - timedelta(seconds=settings.media_debounce_seconds):
            return  # still arriving; the job queued by the latest photo will handle it

        reply = await _run_with_photos(session, conversation, conversation.user_id, "")
        await session.commit()

    if reply:
        await meta.MetaClient().send_text(phone_e164, reply)


def _photos_are_unconsumed(conversation: Conversation) -> bool:
    if not conversation.media_buffer or conversation.media_buffer_at is None:
        return False
    return (
        conversation.last_message_at is None
        or conversation.last_message_at < conversation.media_buffer_at
    )


async def _run_with_photos(session, conversation: Conversation, user_id, text: str) -> str:
    """Download the buffered photos and hand them to the model with the text."""
    meta_client = meta.MetaClient()
    entries = list(conversation.media_buffer or [])[: settings.max_media_per_draft]
    images: list[tuple[bytes, str]] = []
    captions: list[str] = []
    for entry in entries:
        if entry.get("caption"):
            captions.append(entry["caption"])
        try:
            images.append(await meta_client.get_media(entry["id"]))
        except Exception:  # noqa: BLE001 — a lost photo must not lose the turn
            logger.exception("Could not download media %s", entry.get("id"))

    if not images:
        return "No pude descargar las fotos. ¿Me las reenviás?"

    prompt = " ".join([*captions, text]).strip()
    if agent.over_daily_limit(conversation):
        return QUOTA_REACHED
    return await agent.run_turn(session, conversation, user_id, prompt, images=images)


async def _resolve_reply(ctx: dict, session, inbound: InboundMessage) -> str:
    phone = inbound.phone_e164
    text = (inbound.body or "").strip()

    link = await linking.resolve(session, phone)
    if link is None:
        # An unlinked number gets the same answer whether or not it belongs to a
        # real user — nothing here reveals who is registered.
        if text and linking.is_code(text):
            verified = await linking.try_verify(session, phone, text)
            if verified is None:
                return LINK_FAILED
            await session.commit()
            return await _welcome(verified.user_id)
        return WELCOME_UNKNOWN

    if inbound.kind not in meta.SUPPORTED_KINDS:
        return UNSUPPORTED_MEDIA

    conversation = await agent.get_or_create_conversation(session, phone, link.user_id)

    if inbound.kind == "image":
        # Each photo is its own webhook, so collect and wait for the user to finish
        # instead of answering three times to one upload.
        buffer = list(conversation.media_buffer or [])
        if not _photos_are_unconsumed(conversation):
            buffer = []  # photos from a previous, already answered upload
        if not inbound.media_id:
            return "Esa foto me llegó sin identificador y no la puedo bajar. ¿Me la reenviás?"
        buffer.append({"id": inbound.media_id, "caption": text or None})
        conversation.media_buffer = buffer[: settings.max_media_per_draft]
        conversation.media_buffer_at = _now()
        await session.commit()
        await ctx["redis"].enqueue_job(
            "flush_media", phone, _defer_by=timedelta(seconds=settings.media_debounce_seconds)
        )
        return ""

    if not text:
        return "No me llegó texto en ese mensaje. ¿Me contás qué necesitás?"

    if _photos_are_unconsumed(conversation):
        # The text is the description for the photos that just arrived.
        return await _run_with_photos(session, conversation, link.user_id, text)

    if agent.over_daily_limit(conversation):
        await session.commit()
        return QUOTA_REACHED

    return await agent.run_turn(session, conversation, link.user_id, text)


async def _welcome(user_id) -> str:
    """Name the agency back so the user can see the link landed on the right account."""
    from app.services.stockar import StockarClient, StockarError

    try:
        profile = await StockarClient(user_id).me()
    except StockarError:
        return "¡Listo! Tu número quedó vinculado a Stockar."
    company = (profile.get("company") or {}).get("name")
    who = f" de {company}" if company else ""
    return (
        f"¡Listo, {profile.get('full_name', '')}! Tu número quedó vinculado a la cuenta{who}.\n\n"
        "Preguntame por stock de la red, tus autos, La Lonja o cuánto vale un auto, o mandame "
        "fotos de un auto con los datos para cargarlo."
    )


async def requeue_stuck(ctx: dict) -> None:
    """Put back messages whose worker died mid-turn.

    A message is marked `processing` before the work starts, so a crash or a SIGKILL
    between that and the final commit would strand it forever. Anything older than
    the cutoff cannot still be running: the job timeout is far shorter.
    """
    cutoff = _now() - timedelta(seconds=settings.stuck_message_seconds)
    async with AsyncSessionLocal() as session:
        stuck = (
            await session.scalars(
                select(InboundMessage).where(
                    InboundMessage.status == "processing",
                    InboundMessage.received_at < cutoff,
                )
            )
        ).all()
        for message in stuck:
            message.status = "queued"
        await session.commit()

        for message in stuck:
            logger.warning("Requeueing stranded message %s", message.meta_message_id)
            await ctx["redis"].enqueue_job("process_message", message.meta_message_id)


async def _wait_for_schema(ctx: dict) -> None:
    """Hold until the agent's tables exist.

    Migrations run in the web service, so on a clean deploy the worker can start
    against a database that has nothing in it yet.
    """
    for attempt in range(settings.schema_wait_attempts):
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(select(InboundMessage.id).limit(1))
            if attempt:
                logger.info("Agent schema ready after %s attempt(s)", attempt + 1)
            return
        except Exception:  # noqa: BLE001 — the table is simply not there yet
            await asyncio.sleep(settings.schema_wait_seconds)
    raise RuntimeError("Agent schema never became available; are migrations running?")


class WorkerSettings:
    functions = [process_message, flush_media]
    cron_jobs = [cron(requeue_stuck, minute=set(range(0, 60, 5)), run_at_startup=True)]
    on_startup = _wait_for_schema
    redis_settings = build_redis_settings()
    max_jobs = 10
    job_timeout = 180
