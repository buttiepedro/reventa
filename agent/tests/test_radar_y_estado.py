"""El estado lo elige el usuario, y el Radar entra en la conversación."""

import pytest

from app.services import actions, agent, tools
from tests.conftest import needs_db
from tests.fakes import FakeMeta, FakeStockar

pytestmark = needs_db

BASE = {
    "brand": "Toyota", "model": "Corolla", "year": 2019, "color": "gris",
    "mileage": 80000, "fuel_type": "gasoline", "transmission": "automatic",
    "price_resale": 25000000,
}


@pytest.fixture(autouse=True)
def fake_meta(monkeypatch):
    monkeypatch.setattr(actions, "MetaClient", lambda: FakeMeta())


@pytest.fixture
async def ctx(session, phone, user_id):
    conversation = await agent.get_or_create_conversation(session, phone, user_id)
    return tools.ToolContext(
        client=FakeStockar(), session=session, conversation=conversation, user_id=user_id
    )


class TestEstadoAlCargar:
    @pytest.mark.parametrize("estado", ["available", "pre_toma"])
    async def test_se_crea_en_el_estado_pedido(self, ctx, estado):
        """Antes esto forzaba pre_toma y convertía en toma un auto que pidieron publicar."""
        await tools.execute(
            "proponer_carga_vehiculo",
            {**BASE, "status": estado, "resumen": "Corolla 2019"},
            ctx,
        )
        await tools.execute("confirmar_accion_pendiente", {}, ctx)

        _, path, payload, _ = ctx.client.calls[0]
        assert path == "/vehicles"
        assert payload["status"] == estado

    async def test_el_estado_es_obligatorio_en_el_esquema(self):
        """Para que el modelo tenga que preguntarlo en vez de asumirlo."""
        tool = next(t for t in tools.TOOLS if t["name"] == "proponer_carga_vehiculo")
        assert "status" in tool["input_schema"]["required"]
        assert tool["input_schema"]["properties"]["status"]["enum"] == ["available", "pre_toma"]

    async def test_la_respuesta_dice_en_qué_estado_quedó(self, ctx):
        await tools.execute(
            "proponer_carga_vehiculo",
            {**BASE, "status": "available", "resumen": "x"},
            ctx,
        )
        out, _ = await tools.execute("confirmar_accion_pendiente", {}, ctx)
        assert "publicado en la red" in out


class TestLiquidarAlCargar:
    async def test_crea_y_liquida_en_un_paso(self, ctx):
        """Sin esto había que pasar por pre-toma y disponible antes de liquidar."""
        await tools.execute(
            "proponer_carga_vehiculo",
            {**BASE, "status": "available", "liquidacion_price": 20000000, "resumen": "x"},
            ctx,
        )
        out, _ = await tools.execute("confirmar_accion_pendiente", {}, ctx)

        metodos = [(c[0], c[1]) for c in ctx.client.calls]
        assert ("POST", "/vehicles") in metodos
        assert ("PATCH", "/vehicles/veh-1/liquidar") in metodos
        assert "liquidación" in out

    async def test_el_precio_de_liquidacion_no_viaja_en_el_alta(self, ctx):
        await tools.execute(
            "proponer_carga_vehiculo",
            {**BASE, "status": "available", "liquidacion_price": 20000000, "resumen": "x"},
            ctx,
        )
        await tools.execute("confirmar_accion_pendiente", {}, ctx)

        _, _, payload, _ = ctx.client.calls[0]
        assert "liquidacion_price" not in payload, "la API de alta no conoce ese campo"

    async def test_sin_precio_de_liquidacion_no_se_liquida(self, ctx):
        await tools.execute(
            "proponer_carga_vehiculo", {**BASE, "status": "available", "resumen": "x"}, ctx
        )
        await tools.execute("confirmar_accion_pendiente", {}, ctx)

        assert not any("liquidar" in c[1] for c in ctx.client.calls)


class TestRadar:
    async def test_proponer_no_escribe(self, ctx):
        out, is_error = await tools.execute(
            "proponer_entrada_radar",
            {"brand": "Toyota", "model": "Corolla", "max_price": 25000000, "resumen": "Buscar Corollas"},
            ctx,
        )
        assert not is_error
        assert ctx.client.calls == []
        assert ctx.conversation.pending_action["type"] == "crear_entrada_radar"

    async def test_confirmar_lo_agrega(self, ctx):
        await tools.execute(
            "proponer_entrada_radar",
            {"brand": "Toyota", "max_price": 25000000, "resumen": "x"},
            ctx,
        )
        await tools.execute("confirmar_accion_pendiente", {}, ctx)

        method, path, payload, _ = ctx.client.calls[0]
        assert (method, path) == ("POST", "/companies/me/radar")
        assert payload == {"brand": "Toyota", "max_price": 25000000}

    async def test_los_campos_vacios_no_viajan(self, ctx):
        await tools.execute(
            "proponer_entrada_radar", {"brand": "Fiat", "model": None, "resumen": "x"}, ctx
        )
        await tools.execute("confirmar_accion_pendiente", {}, ctx)

        assert ctx.client.calls[0][2] == {"brand": "Fiat"}


class TestPistaDelRadar:
    async def test_vacio_pide_preguntarlo_una_vez(self):
        class Vacio(FakeStockar):
            async def get(self, path, params=None):
                return 200, []

        hint = await agent._radar_hint(Vacio())
        assert "VACÍO" in hint
        assert "una sola vez" in hint
        assert "no insistas" in hint

    async def test_cargado_sirve_para_recomendar(self):
        class ConDatos(FakeStockar):
            async def get(self, path, params=None):
                return 200, [{"brand": "Toyota", "model": "Corolla"}, {"brand": "Fiat"}]

        hint = await agent._radar_hint(ConDatos())
        assert "Toyota Corolla" in hint and "Fiat" in hint
        assert "VACÍO" not in hint

    async def test_si_falla_no_se_menciona(self):
        class Rota(FakeStockar):
            async def get(self, path, params=None):
                return 500, {"detail": "boom"}

        assert "no lo menciones" in await agent._radar_hint(Rota())
