"""Meta's webhook. Validates, records and enqueues — never processes inline.

Meta gives roughly 15 seconds and retries anything slower, so the only work done
here is what is needed to make that retry safe.
"""

import logging

from fastapi import APIRouter, Header, Request, Response, status
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.inbound import InboundMessage
from app.services import meta

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def verify_webhook(request: Request) -> Response:
    """Meta's subscription handshake."""
    params = request.query_params
    if (
        params.get("hub.mode") == "subscribe"
        and settings.meta_verify_token
        and params.get("hub.verify_token") == settings.meta_verify_token
    ):
        return Response(content=params.get("hub.challenge", ""), media_type="text/plain")
    return Response(status_code=status.HTTP_403_FORBIDDEN)


@router.post("")
async def receive_webhook(
    request: Request,
    x_hub_signature_256: str = Header(default=None),
) -> Response:
    raw = await request.body()
    if not meta.verify_signature(raw, x_hub_signature_256):
        logger.warning("Rejected webhook with invalid signature")
        return Response(status_code=status.HTTP_403_FORBIDDEN)

    payload = await request.json()
    messages = meta.parse_messages(payload)

    async with AsyncSessionLocal() as session:
        for message in messages:
            if not message["meta_message_id"]:
                continue
            # A repeat delivery conflicts here and is dropped, so the same photo is
            # never loaded twice.
            result = await session.execute(
                insert(InboundMessage)
                .values(
                    meta_message_id=message["meta_message_id"],
                    phone_e164=message["phone_e164"],
                    kind=message["kind"],
                    body=message["body"] or message["caption"],
                    media_id=message["media_id"],
                )
                .on_conflict_do_nothing(index_elements=["meta_message_id"])
                .returning(InboundMessage.id)
            )
            if result.scalar_one_or_none() is None:
                continue
            await session.commit()
            await request.app.state.queue.enqueue_job(
                "process_message", message["meta_message_id"]
            )
        await session.commit()

    return Response(status_code=status.HTTP_200_OK)
