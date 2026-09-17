"""Proposed writes, and the only path that executes them.

Nothing in the agent writes to Stockar directly. A write is first *proposed* — it
lands in `conversation.pending_action` and the user sees a summary — and only a
later, explicit confirmation runs it. Because execution reads the stored payload
rather than anything the model says at confirmation time, what runs is exactly what
the user was shown.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.action import AgentAction
from app.models.conversation import Conversation
from app.services.meta import MetaClient
from app.services.stockar import StockarClient

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def propose(
    conversation: Conversation,
    action_type: str,
    payload: dict,
    summary: str,
    media_ids: list[str] | None = None,
) -> None:
    conversation.pending_action = {
        "type": action_type,
        "payload": payload,
        "summary": summary,
        "media_ids": media_ids or [],
        "proposed_at": _now().isoformat(),
    }
    conversation.pending_expires_at = _now() + timedelta(minutes=settings.pending_action_ttl_minutes)


def discard(conversation: Conversation) -> None:
    conversation.pending_action = None
    conversation.pending_expires_at = None


def describe_pending(conversation: Conversation) -> str | None:
    """What the model is told about an outstanding proposal."""
    pending = conversation.pending_action
    if not pending or is_expired(conversation):
        return None
    return f"{pending['type']}: {pending['summary']}"


def is_expired(conversation: Conversation) -> bool:
    if not conversation.pending_action:
        return True
    expires = conversation.pending_expires_at
    return expires is None or expires <= _now()


async def confirm(
    session: AsyncSession,
    conversation: Conversation,
    client: StockarClient,
    user_id: uuid.UUID,
) -> str:
    """Run the stored proposal. Returns the text the model should relay."""
    pending = conversation.pending_action
    if not pending:
        return "No hay ninguna acción pendiente de confirmar. Volvé a pedirle al usuario qué necesita."
    if is_expired(conversation):
        summary = pending.get("summary", "")
        discard(conversation)
        return (
            "La propuesta venció por tiempo y no se ejecutó. Mostrale de nuevo el resumen "
            f"al usuario y pedile que confirme otra vez. Era: {summary}"
        )

    handler = _HANDLERS.get(pending["type"])
    if handler is None:
        discard(conversation)
        return f"No sé ejecutar una acción de tipo {pending['type']}."

    try:
        status_code, message = await handler(client, pending)
    except Exception as exc:  # noqa: BLE001 — surfaced to the user, not swallowed
        logger.exception("Action %s failed", pending["type"])
        status_code, message = 0, f"No se pudo completar: {exc}"

    session.add(
        AgentAction(
            user_id=user_id,
            phone_e164=conversation.phone_e164,
            tool=pending["type"],
            arguments=pending.get("payload", {}),
            status_code=status_code or None,
            response=message[:4000],
        )
    )
    discard(conversation)
    return message


# ─── Handlers ────────────────────────────────────────────────


async def _crear_vehiculo(client: StockarClient, pending: dict) -> tuple[int, str]:
    payload = dict(pending["payload"])
    # Anything loaded from a photo is a pre-toma: reversible, and it expires on its
    # own if it turns out the agent misread the car.
    payload["status"] = "pre_toma"
    payload.setdefault("condition", "used")
    if payload.get("price_public") is None:
        payload["price_public"] = payload.get("price_resale")

    status_code, body = await client.post("/vehicles", payload)
    if status_code >= 400 or not isinstance(body, dict):
        detail = body.get("detail") if isinstance(body, dict) else body
        return status_code, f"Stockar rechazó la carga ({status_code}): {detail}"

    vehicle_id = body["id"]
    uploaded, failed = await _attach_photos(client, vehicle_id, pending.get("media_ids", []))

    link = ""
    if settings.app_public_url and body.get("share_token"):
        link = f" {settings.app_public_url.rstrip('/')}/share/{body['share_token']}"

    note = f"Se creó el vehículo con {uploaded} foto(s)."
    if failed:
        note += f" {failed} foto(s) no se pudieron subir; el auto quedó cargado igual."
    return status_code, f"{note}{link}"


async def _attach_photos(client: StockarClient, vehicle_id: str, media_ids: list[str]) -> tuple[int, int]:
    """Push the buffered photos into the freshly created vehicle.

    A photo that fails is reported, never retried silently — the vehicle already
    exists and a half-finished upload must not look like a failed load.
    """
    meta_client = MetaClient()
    uploaded = 0
    failed = 0
    for index, media_id in enumerate(media_ids[: settings.max_media_per_draft]):
        try:
            content, mime = await meta_client.get_media(media_id)
            extension = "png" if "png" in mime else "jpg"
            status_code, _ = await client.post_file(
                f"/vehicles/{vehicle_id}/images/upload",
                content,
                f"whatsapp-{index}.{extension}",
                mime,
                params={"display_order": index, "is_primary": index == 0},
            )
            if status_code >= 400:
                failed += 1
            else:
                uploaded += 1
        except Exception:  # noqa: BLE001
            logger.exception("Photo %s failed for vehicle %s", media_id, vehicle_id)
            failed += 1
    return uploaded, failed

# ─── Handlers: the rest of the write surface ─────────────────
#
# Each builds its own request from the stored payload. Nothing here takes a path
# or a method from the model — only values it validated into a known shape.


async def _cambiar_estado(client: StockarClient, pending: dict) -> tuple[int, str]:
    payload = pending["payload"]
    status_code, body = await client.request(
        "PATCH", f"/vehicles/{payload['vehicle_id']}/status", json={"status": payload["status"]}
    )
    return _report(status_code, body, f"El vehículo quedó en estado {payload['status']}.")


async def _cambiar_precio(client: StockarClient, pending: dict) -> tuple[int, str]:
    payload = pending["payload"]
    body_data = {
        k: payload[k] for k in ("price_resale", "price_public") if payload.get(k) is not None
    }
    status_code, body = await client.request(
        "PUT", f"/vehicles/{payload['vehicle_id']}", json=body_data
    )
    return _report(status_code, body, "Precio actualizado.")


async def _liquidar(client: StockarClient, pending: dict) -> tuple[int, str]:
    payload = pending["payload"]
    status_code, body = await client.request(
        "PATCH",
        f"/vehicles/{payload['vehicle_id']}/liquidar",
        json={"liquidacion_price": payload["liquidacion_price"]},
    )
    return _report(status_code, body, "El vehículo quedó publicado en liquidación.")


async def _crear_solicitud(client: StockarClient, pending: dict) -> tuple[int, str]:
    payload = {k: v for k, v in pending["payload"].items() if v is not None}
    status_code, body = await client.post("/lonja/requests", payload)
    return _report(status_code, body, "La solicitud quedó publicada en La Lonja.")


async def _ofertar(client: StockarClient, pending: dict) -> tuple[int, str]:
    payload = pending["payload"]
    status_code, body = await client.post(
        f"/lonja/requests/{payload['request_id']}/offers",
        {"vehicle_id": payload["vehicle_id"], "message": payload.get("message")},
    )
    return _report(status_code, body, "Oferta enviada.")


async def _responder_oferta(client: StockarClient, pending: dict) -> tuple[int, str]:
    payload = pending["payload"]
    # This endpoint takes the new status on the query string, not in the body.
    status_code, body = await client.request(
        "PATCH",
        f"/lonja/offers/{payload['offer_id']}",
        params={"new_status": payload["new_status"]},
    )
    done = "aceptada" if payload["new_status"] == "accepted" else "rechazada"
    return _report(status_code, body, f"Oferta {done}.")


async def _marcar_interes(client: StockarClient, pending: dict) -> tuple[int, str]:
    payload = pending["payload"]
    status_code, body = await client.post(f"/vehicles/{payload['vehicle_id']}/interest")
    return _report(status_code, body, "Quedó marcado el interés; la agencia dueña ya fue avisada.")


def _report(status_code: int, body: object, success: str) -> tuple[int, str]:
    if status_code >= 400:
        detail = body.get("detail") if isinstance(body, dict) else body
        return status_code, f"Stockar rechazó la operación ({status_code}): {detail}"
    return status_code, success


_HANDLERS = {
    "crear_vehiculo": _crear_vehiculo,
    "cambiar_estado": _cambiar_estado,
    "cambiar_precio": _cambiar_precio,
    "liquidar": _liquidar,
    "crear_solicitud": _crear_solicitud,
    "ofertar": _ofertar,
    "responder_oferta": _responder_oferta,
    "marcar_interes": _marcar_interes,
}
