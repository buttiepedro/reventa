"""What happens when the worker dies mid-turn, or starts before the database is ready."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.inbound import InboundMessage
import app.worker as worker
from tests.conftest import needs_db

pytestmark = needs_db


class FakeRedis:
    def __init__(self):
        self.jobs = []

    async def enqueue_job(self, name, *args, **kwargs):
        self.jobs.append((name, args))


@pytest.fixture
def ctx():
    return {"redis": FakeRedis()}


async def _message(session, phone, status_value, age_seconds):
    message = InboundMessage(
        meta_message_id=f"wamid.{phone}-{status_value}-{age_seconds}",
        phone_e164=phone,
        kind="text",
        body="hola",
        status=status_value,
        received_at=datetime.now(timezone.utc) - timedelta(seconds=age_seconds),
    )
    session.add(message)
    await session.commit()
    return message


async def test_a_message_stranded_in_processing_is_requeued(session, ctx, phone):
    """A worker killed between the status flag and the commit must not lose the turn."""
    stranded = await _message(session, phone, "processing", settings.stuck_message_seconds + 60)

    await worker.requeue_stuck(ctx)

    await session.refresh(stranded)
    assert stranded.status == "queued"
    assert ("process_message", (stranded.meta_message_id,)) in ctx["redis"].jobs


async def test_a_message_still_being_processed_is_left_alone(session, ctx, phone):
    recent = await _message(session, phone, "processing", 5)

    await worker.requeue_stuck(ctx)

    await session.refresh(recent)
    assert recent.status == "processing", "a live turn was restarted underneath itself"
    assert ctx["redis"].jobs == []


async def test_finished_messages_are_never_replayed(session, ctx, phone):
    done = await _message(session, phone, "done", settings.stuck_message_seconds + 60)
    failed = await _message(session, phone, "error", settings.stuck_message_seconds + 60)

    await worker.requeue_stuck(ctx)

    for message in (done, failed):
        await session.refresh(message)
    assert (done.status, failed.status) == ("done", "error")
    assert ctx["redis"].jobs == []


async def test_the_worker_waits_for_the_schema(ctx):
    """On a clean deploy the tables may not exist yet; the worker must not crash-loop."""
    await worker._wait_for_schema(ctx)  # schema is there: returns without sleeping


async def test_the_worker_gives_up_if_the_schema_never_arrives(ctx, monkeypatch):
    monkeypatch.setattr(settings, "schema_wait_attempts", 2)
    monkeypatch.setattr(settings, "schema_wait_seconds", 0)

    def broken():
        raise RuntimeError("no database")

    monkeypatch.setattr(worker, "AsyncSessionLocal", broken)

    with pytest.raises(RuntimeError, match="never became available"):
        await worker._wait_for_schema(ctx)
