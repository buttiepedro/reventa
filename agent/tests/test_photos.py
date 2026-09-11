"""WhatsApp sends one webhook per photo, so a three-photo upload is three messages."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.inbound import InboundMessage
from app.models.link import WhatsAppLink
from app.services import agent
import app.worker as worker
from tests.conftest import needs_db

pytestmark = needs_db


class FakeRedis:
    def __init__(self):
        self.jobs = []

    async def enqueue_job(self, name, *args, **kwargs):
        self.jobs.append((name, args, kwargs))


@pytest.fixture
async def linked(session, phone, user_id):
    session.add(WhatsAppLink(user_id=user_id, phone_e164=phone,
                             verified_at=datetime.now(timezone.utc)))
    await session.commit()
    return user_id


@pytest.fixture
def ctx():
    return {"redis": FakeRedis()}


def photo(phone, media_id, caption=None):
    return InboundMessage(meta_message_id=f"wamid.{media_id}", phone_e164=phone,
                          kind="image", body=caption, media_id=media_id)


async def test_photos_are_collected_without_replying_to_each_one(session, ctx, phone, linked):
    for index, media_id in enumerate(["m1", "m2", "m3"]):
        caption = "Corolla XEI 2019" if index == 0 else None
        reply = await worker._resolve_reply(ctx, session, photo(phone, media_id, caption))
        assert reply == "", f"photo {media_id} produced a reply of its own"

    conversation = await agent.get_or_create_conversation(session, phone, linked)
    assert [entry["id"] for entry in conversation.media_buffer] == ["m1", "m2", "m3"]
    assert conversation.media_buffer[0]["caption"] == "Corolla XEI 2019"


async def test_each_photo_schedules_a_deferred_flush(session, ctx, phone, linked):
    await worker._resolve_reply(ctx, session, photo(phone, "m1"))

    name, args, kwargs = ctx["redis"].jobs[0]
    assert name == "flush_media"
    assert args[0] == phone
    assert "_defer_by" in kwargs, "the flush would fire before the user finished uploading"


async def test_a_flush_that_fires_too_early_leaves_the_photos_alone(session, ctx, phone, linked):
    await worker._resolve_reply(ctx, session, photo(phone, "m1"))

    await worker.flush_media(ctx, phone)  # photos just arrived

    conversation = await agent.get_or_create_conversation(session, phone, linked)
    assert worker._photos_are_unconsumed(conversation) is True


async def test_photos_already_answered_are_not_processed_again(session, ctx, phone, linked):
    await worker._resolve_reply(ctx, session, photo(phone, "m1"))
    conversation = await agent.get_or_create_conversation(session, phone, linked)

    conversation.last_message_at = datetime.now(timezone.utc) + timedelta(seconds=1)
    await session.commit()

    assert worker._photos_are_unconsumed(conversation) is False
    await worker.flush_media(ctx, phone)  # must be a no-op, not a second reply


async def test_a_photo_without_a_media_id_is_reported(session, ctx, phone, linked):
    broken = InboundMessage(meta_message_id="wamid.broken", phone_e164=phone,
                            kind="image", body=None, media_id=None)

    assert "reenviás" in await worker._resolve_reply(ctx, session, broken)


async def test_audio_is_declined(session, ctx, phone, linked):
    audio = InboundMessage(meta_message_id="wamid.audio", phone_e164=phone,
                           kind="audio", body=None)

    assert "Audios" in await worker._resolve_reply(ctx, session, audio)


async def test_an_unlinked_number_is_told_nothing(session, ctx, phone):
    message = InboundMessage(meta_message_id="wamid.x", phone_e164=phone,
                             kind="text", body="¿qué stock tenés?")

    reply = await worker._resolve_reply(ctx, session, message)

    assert "no tengo este número" in reply.lower()
    assert "Conectar WhatsApp" in reply
