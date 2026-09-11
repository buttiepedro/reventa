"""Meta retries deliveries; the same message must not be processed twice."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.models.inbound import InboundMessage
from tests.conftest import needs_db

pytestmark = needs_db


async def _store(session, meta_message_id: str, phone: str):
    """The exact statement the webhook uses."""
    result = await session.execute(
        insert(InboundMessage)
        .values(meta_message_id=meta_message_id, phone_e164=phone, kind="text", body="hola")
        .on_conflict_do_nothing(index_elements=["meta_message_id"])
        .returning(InboundMessage.id)
    )
    await session.commit()
    return result.scalar_one_or_none()


async def test_a_retried_delivery_is_not_queued_again(session, phone):
    message_id = "wamid." + uuid.uuid4().hex

    first = await _store(session, message_id, phone)
    second = await _store(session, message_id, phone)

    assert first is not None
    assert second is None, "a Meta retry would have run the turn twice"
    stored = await session.scalar(
        select(func.count()).select_from(InboundMessage)
        .where(InboundMessage.meta_message_id == message_id)
    )
    assert stored == 1
