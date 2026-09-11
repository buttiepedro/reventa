"""Binding a number to an account — the agent's whole notion of identity."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.link import WhatsAppLink
from app.services import linking
from tests.conftest import needs_db

pytestmark = needs_db


class TestCodeFormat:
    @pytest.mark.parametrize("value", ["123456", " 000000 "])
    def test_accepts_six_digits(self, value):
        assert linking.is_code(value)

    @pytest.mark.parametrize("value", ["12345", "1234567", "abcdef", ""])
    def test_rejects_anything_else(self, value):
        assert not linking.is_code(value)


async def test_a_correct_code_links_the_number(session, phone, user_id):
    code, expires = await linking.start_link(session, user_id)
    assert len(code) == 6 and code.isdigit()
    assert expires > datetime.now(timezone.utc)
    await session.commit()

    link = await linking.try_verify(session, phone, code)
    assert link is not None
    assert link.phone_e164 == phone
    assert link.verified_at is not None
    assert link.code_hash is None, "the code outlived its use"
    await session.commit()

    assert (await linking.resolve(session, phone)).user_id == user_id


async def test_a_wrong_code_links_nothing(session, phone, user_id):
    await linking.start_link(session, user_id)
    await session.commit()
    assert await linking.try_verify(session, phone, "000001") is None
    await session.rollback()
    assert await linking.resolve(session, phone) is None


async def test_an_expired_code_is_dead(session, phone, user_id):
    code, _ = await linking.start_link(session, user_id)
    await session.commit()
    pending = await session.scalar(select(WhatsAppLink).where(WhatsAppLink.user_id == user_id))
    pending.code_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    await session.commit()

    assert await linking.try_verify(session, phone, code) is None


async def test_attempts_are_capped(session, phone, user_id):
    code, _ = await linking.start_link(session, user_id)
    await session.commit()
    for _ in range(6):
        await linking.try_verify(session, phone, "000001")
        await session.commit()

    assert await linking.try_verify(session, phone, code) is None, "guessing was unlimited"


async def test_a_number_cannot_belong_to_two_accounts(session, phone, user_id):
    code, _ = await linking.start_link(session, user_id)
    await session.commit()
    await linking.try_verify(session, phone, code)
    await session.commit()

    intruder = uuid.uuid4()
    other_code, _ = await linking.start_link(session, intruder)
    await session.commit()

    assert await linking.try_verify(session, phone, other_code) is None
    await session.rollback()
    assert (await linking.resolve(session, phone)).user_id == user_id


async def test_the_masked_status_never_shows_the_full_number(session, phone, user_id):
    code, _ = await linking.start_link(session, user_id)
    await session.commit()
    await linking.try_verify(session, phone, code)
    await session.commit()

    status = await linking.status(session, user_id)
    assert status["linked"] is True
    assert phone not in status["phone_masked"]
    assert "•" in status["phone_masked"]


async def test_revoking_frees_the_number_for_relinking(session, phone, user_id):
    code, _ = await linking.start_link(session, user_id)
    await session.commit()
    await linking.try_verify(session, phone, code)
    await session.commit()

    await linking.revoke(session, user_id)
    await session.commit()
    assert await linking.resolve(session, phone) is None
    assert (await linking.status(session, user_id))["linked"] is False

    again, _ = await linking.start_link(session, user_id)
    await session.commit()
    assert await linking.try_verify(session, phone, again) is not None
