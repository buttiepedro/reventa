"""Every write tool stages a proposal and only the confirmation executes it."""

import pytest

from app.services import actions, agent, tools
from tests.conftest import needs_db
from tests.fakes import FakeReventa

pytestmark = needs_db

# tool name -> (arguments, the single request its confirmation must produce)
CASES = [
    ("proponer_cambio_estado",
     {"vehicle_id": "v1", "status": "sold", "resumen": "Marcar vendido el Corolla"},
     ("PATCH", "/vehicles/v1/status", {"status": "sold"}, None)),
    ("proponer_cambio_precio",
     {"vehicle_id": "v1", "price_resale": 26000000, "resumen": "Subir reventa a $26M"},
     ("PUT", "/vehicles/v1", {"price_resale": 26000000}, None)),
    ("proponer_liquidacion",
     {"vehicle_id": "v1", "liquidacion_price": 20000000, "resumen": "Liquidar a $20M"},
     ("PATCH", "/vehicles/v1/liquidar", {"liquidacion_price": 20000000}, None)),
    ("proponer_solicitud_lonja",
     {"budget_max": 25000000, "reference_models": ["Corolla"], "resumen": "Busco Corolla"},
     ("POST", "/lonja/requests", {"budget_max": 25000000, "reference_models": ["Corolla"]}, None)),
    ("proponer_oferta",
     {"request_id": "r1", "vehicle_id": "v1", "message": "tengo este", "resumen": "Ofertar"},
     ("POST", "/lonja/requests/r1/offers", {"vehicle_id": "v1", "message": "tengo este"}, None)),
    ("proponer_respuesta_oferta",
     {"offer_id": "o1", "new_status": "accepted", "resumen": "Aceptar la oferta"},
     ("PATCH", "/lonja/offers/o1", None, {"new_status": "accepted"})),
    ("proponer_interes_pretoma",
     {"vehicle_id": "v9", "resumen": "Marcar interés"},
     ("POST", "/vehicles/v9/interest", None, None)),
]


@pytest.fixture
async def ctx(session, phone, user_id):
    conversation = await agent.get_or_create_conversation(session, phone, user_id)
    return tools.ToolContext(
        client=FakeReventa(), session=session, conversation=conversation, user_id=user_id
    )


def test_the_catalogue_matches_the_implementation():
    """A tool the model can call but nothing implements would fail mid-conversation."""
    names = {tool["name"] for tool in tools.TOOLS}
    assert set(tools._STATEFUL) <= names
    assert all(tool["name"] for tool in tools.TOOLS)
    assert len(names) == len(tools.TOOLS), "duplicate tool name"


@pytest.mark.parametrize("tool_name,args,_expected", CASES)
async def test_proposing_never_calls_reventa(ctx, tool_name, args, _expected):
    output, is_error = await tools.execute(tool_name, args, ctx)

    assert not is_error
    assert "NO se aplicó" in output
    assert ctx.client.calls == [], f"{tool_name} wrote without confirmation"
    assert ctx.conversation.pending_action["summary"] == args["resumen"]


@pytest.mark.parametrize("tool_name,args,_expected", CASES)
async def test_every_proposal_has_a_handler(ctx, tool_name, args, _expected):
    await tools.execute(tool_name, args, ctx)

    assert ctx.conversation.pending_action["type"] in actions._HANDLERS


@pytest.mark.parametrize("tool_name,args,expected", CASES)
async def test_confirming_sends_exactly_one_expected_request(ctx, tool_name, args, expected):
    await tools.execute(tool_name, args, ctx)

    output, is_error = await tools.execute("confirmar_accion_pendiente", {}, ctx)

    assert not is_error, output
    assert ctx.client.calls == [expected]
    assert ctx.conversation.pending_action is None


async def test_discarding_clears_without_writing(ctx):
    await tools.execute("proponer_cambio_estado",
                        {"vehicle_id": "v1", "status": "sold", "resumen": "x"}, ctx)

    output, _ = await tools.execute("descartar_accion_pendiente", {}, ctx)

    assert ctx.client.calls == []
    assert ctx.conversation.pending_action is None
    assert "No se cargó ni se modificó nada" in output
