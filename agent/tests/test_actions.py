"""Nothing reaches Stockar without an explicit confirmation. That is the rule."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.action import AgentAction
from app.services import actions, agent
from tests.conftest import needs_db
from tests.fakes import FakeMeta, FakeStockar

pytestmark = needs_db

DRAFT = {
    "brand": "Toyota", "model": "Corolla", "year": 2019, "color": "gris",
    "mileage": 80000, "fuel_type": "gasoline", "transmission": "automatic",
    "price_resale": 25000000,
}


@pytest.fixture(autouse=True)
def fake_meta(monkeypatch):
    monkeypatch.setattr(actions, "MetaClient", lambda: FakeMeta())


@pytest.fixture
async def conversation(session, phone, user_id):
    return await agent.get_or_create_conversation(session, phone, user_id)


async def test_proposing_does_not_write(conversation):
    client = FakeStockar()
    actions.propose(conversation, "crear_vehiculo", dict(DRAFT), "Corolla 2019", ["m1"])

    assert client.calls == []
    assert "Corolla 2019" in actions.describe_pending(conversation)
    assert not actions.is_expired(conversation)


async def test_confirming_creates_the_vehicle_as_a_pre_toma(session, conversation, user_id):
    client = FakeStockar()
    actions.propose(conversation, "crear_vehiculo", dict(DRAFT), "Corolla 2019", ["m1", "m2"])

    message = await actions.confirm(session, conversation, client, user_id)

    assert "2 foto(s)" in message
    _, path, payload, _ = client.calls[0]
    assert path == "/vehicles"
    assert payload["status"] == "pre_toma", "a car loaded over WhatsApp must be reversible"
    assert payload["condition"] == "used"
    assert conversation.pending_action is None


async def test_the_public_price_falls_back_to_the_resale_price(session, conversation, user_id):
    client = FakeStockar()
    actions.propose(conversation, "crear_vehiculo", dict(DRAFT), "resumen", [])

    await actions.confirm(session, conversation, client, user_id)

    assert client.calls[0][2]["price_public"] == 25000000


async def test_the_first_photo_becomes_the_cover(session, conversation, user_id):
    client = FakeStockar()
    actions.propose(conversation, "crear_vehiculo", dict(DRAFT), "resumen", ["m1", "m2", "m3"])

    await actions.confirm(session, conversation, client, user_id)

    assert client.uploads[0][2] == {"display_order": 0, "is_primary": True}
    assert [u[2]["is_primary"] for u in client.uploads] == [True, False, False]


async def test_an_expired_proposal_is_never_executed(session, conversation, user_id):
    client = FakeStockar()
    actions.propose(conversation, "crear_vehiculo", dict(DRAFT), "el Corolla gris", ["m1"])
    conversation.pending_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)

    message = await actions.confirm(session, conversation, client, user_id)

    assert client.calls == [], "a stale confirmation went through"
    assert "venció" in message
    assert "el Corolla gris" in message, "the user cannot re-confirm what they cannot see"
    assert conversation.pending_action is None


async def test_a_rejection_from_stockar_is_reported_verbatim(session, conversation, user_id):
    client = FakeStockar(fail_with=(422, "precio inválido"))
    actions.propose(conversation, "crear_vehiculo", dict(DRAFT), "resumen", [])

    message = await actions.confirm(session, conversation, client, user_id)

    assert "precio inválido" in message
    assert conversation.pending_action is None


async def test_confirming_nothing_does_nothing(session, conversation, user_id):
    client = FakeStockar()
    message = await actions.confirm(session, conversation, client, user_id)

    assert client.calls == []
    assert "No hay ninguna acción pendiente" in message


async def test_every_write_is_audited(session, conversation, user_id):
    client = FakeStockar()
    actions.propose(conversation, "crear_vehiculo", dict(DRAFT), "resumen", [])

    await actions.confirm(session, conversation, client, user_id)
    await session.commit()

    logged = (await session.scalars(select(AgentAction).where(AgentAction.user_id == user_id))).all()
    assert len(logged) == 1
    assert logged[0].tool == "crear_vehiculo"
    assert logged[0].arguments["brand"] == "Toyota"
    assert logged[0].phone_e164 == conversation.phone_e164
