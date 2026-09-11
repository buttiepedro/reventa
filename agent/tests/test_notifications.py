"""Proactive messages: off by default, opt-out honoured, every send accounted for."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.link import WhatsAppLink
from app.models.outbound import OutboundNotification
from app.services import notify
from app.services.templates import TEMPLATES
from tests.conftest import needs_db
from tests.fakes import FakeMeta

pytestmark = needs_db


@pytest.fixture
def meta(monkeypatch):
    client = FakeMeta()
    monkeypatch.setattr(notify, "MetaClient", lambda: client)
    return client


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(settings, "enabled_notifications", "nueva_oferta")


@pytest.fixture
async def linked_user(session, phone, user_id):
    session.add(WhatsAppLink(user_id=user_id, phone_e164=phone,
                             verified_at=datetime.now(timezone.utc),
                             notifications_enabled=True))
    await session.commit()
    return user_id


class TestTemplates:
    def test_rendering_fills_the_parameters(self):
        assert TEMPLATES["nueva_oferta"].render({"label": "Corolla 2019"}).startswith(
            "Recibiste una oferta en La Lonja: Corolla 2019"
        )

    def test_parameters_keep_the_order_meta_expects(self):
        template = TEMPLATES["oferta_aceptada"]
        assert template.ordered({"label": "Corolla"}) == ["Corolla"]

    def test_a_missing_parameter_does_not_crash_the_send(self):
        assert "{" not in TEMPLATES["nueva_oferta"].render({})


class TestGates:
    async def test_nothing_is_sent_while_the_template_is_not_enabled(self, session, meta, linked_user):
        """The default state: the agent never starts a conversation."""
        result = await notify.notify_users(session, [linked_user], "nueva_oferta", {"label": "x"})

        assert result["reason"] == "template_not_enabled"
        assert result["sent"] == 0
        assert meta.texts == [] and meta.templates == []

    async def test_an_unknown_template_is_refused(self, session, meta, enabled, linked_user):
        result = await notify.notify_users(session, [linked_user], "inventado", {})

        assert result["reason"] == "unknown_template"
        assert meta.templates == []

    async def test_a_user_who_opted_out_is_skipped(self, session, meta, enabled, linked_user):
        await notify.set_enabled(session, linked_user, False)
        await session.commit()

        result = await notify.notify_users(session, [linked_user], "nueva_oferta", {"label": "x"})

        assert result["sent"] == 0
        assert meta.texts == [] and meta.templates == []

    async def test_an_unlinked_user_is_skipped(self, session, meta, enabled, user_id):
        result = await notify.notify_users(session, [user_id], "nueva_oferta", {"label": "x"})

        assert result["sent"] == 0
        assert result["skipped"] == 1


class TestChannel:
    async def test_outside_the_window_it_costs_a_template(self, session, meta, enabled, linked_user, phone):
        result = await notify.notify_users(session, [linked_user], "nueva_oferta", {"label": "Corolla"})

        assert result["sent"] == 1
        assert meta.texts == [], "free text outside the 24h window would be rejected by Meta"
        to, name, language, params = meta.templates[0]
        assert (to, name, params) == (phone, "nueva_oferta", ["Corolla"])
        assert language == settings.whatsapp_template_language

    async def test_inside_the_window_free_text_is_used(self, session, meta, enabled, linked_user, phone):
        session.add(Conversation(phone_e164=phone, user_id=linked_user, messages=[],
                                 last_message_at=datetime.now(timezone.utc) - timedelta(hours=1)))
        await session.commit()

        result = await notify.notify_users(session, [linked_user], "nueva_oferta", {"label": "Corolla"})

        assert result["sent"] == 1
        assert meta.templates == [], "a paid template was sent while the window was open"
        assert "Corolla" in meta.texts[0][1]

    async def test_a_stale_conversation_falls_back_to_a_template(self, session, meta, enabled, linked_user, phone):
        session.add(Conversation(phone_e164=phone, user_id=linked_user, messages=[],
                                 last_message_at=datetime.now(timezone.utc) - timedelta(hours=25)))
        await session.commit()

        await notify.notify_users(session, [linked_user], "nueva_oferta", {"label": "Corolla"})

        assert meta.texts == []
        assert len(meta.templates) == 1


class TestAudit:
    async def test_a_delivery_is_recorded_with_its_channel(self, session, meta, enabled, linked_user):
        await notify.notify_users(session, [linked_user], "nueva_oferta", {"label": "Corolla"})
        await session.commit()

        logged = (await session.scalars(
            select(OutboundNotification).where(OutboundNotification.user_id == linked_user)
        )).all()
        assert len(logged) == 1
        assert (logged[0].template, logged[0].channel, logged[0].status) == (
            "nueva_oferta", "template", "sent",
        )

    async def test_a_rejected_template_is_recorded_as_failed(self, session, monkeypatch, enabled, linked_user):
        failing = FakeMeta(template_fails=True)
        monkeypatch.setattr(notify, "MetaClient", lambda: failing)

        result = await notify.notify_users(session, [linked_user], "nueva_oferta", {"label": "x"})
        await session.commit()

        assert result["sent"] == 0
        logged = (await session.scalars(
            select(OutboundNotification).where(OutboundNotification.user_id == linked_user)
        )).all()
        assert logged[0].status == "failed"
        assert "not approved" in logged[0].detail
