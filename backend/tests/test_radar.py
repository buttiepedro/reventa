"""El Radar deja de ser una lista de deseos que nadie lee."""

from decimal import Decimal

import pytest

from tests.conftest import needs_db

pytestmark = needs_db

CUIT_A = "30712345671"
CUIT_B = "30712345689"

AUTO = {
    "brand": "Toyota", "model": "Corolla XEI", "year": 2019, "color": "gris",
    "mileage": 80000, "fuel_type": "gasoline", "transmission": "automatic",
    "condition": "used", "price_resale": 25000000, "price_public": 27000000,
}


@pytest.fixture
async def red(client, world, super_admin):
    """Las dos agencias con el CUIT verificado, que es lo que habilita publicar."""
    for key, cuit in (("a", CUIT_A), ("b", CUIT_B)):
        await client.post("/companies/me/cuit", headers=world[key]["headers"], json={"cuit": cuit})
        await client.patch(
            f"/companies/admin/companies/{world[key]['company']['id']}/verify-cuit",
            headers=super_admin, json={"approved": True},
        )
    return world


async def _radar(client, headers, **entry):
    r = await client.post("/companies/me/radar", headers=headers, json=entry)
    assert r.status_code == 201, r.text


async def _avisos(client, headers) -> list[dict]:
    return (await client.get("/notifications", headers=headers)).json()


class TestCoincidencia:
    async def test_un_auto_que_coincide_avisa(self, client, red):
        await _radar(client, red["b"]["headers"], brand="Toyota", max_price=30000000)

        r = await client.post("/vehicles", headers=red["a"]["headers"], json=AUTO)
        assert r.status_code == 201

        avisos = await _avisos(client, red["b"]["headers"])
        assert any(a["entity_type"] == "radar_publicado" for a in avisos)
        assert any("Radar" in a["title"] for a in avisos)

    async def test_el_modelo_matchea_aunque_le_falte_la_version(self, client, red):
        """El modelo es texto libre: pedir "Corolla" tiene que encontrar un "Corolla XEI"."""
        await _radar(client, red["b"]["headers"], brand="Toyota", model="Corolla")

        await client.post("/vehicles", headers=red["a"]["headers"], json=AUTO)

        assert any(a["entity_type"] == "radar_publicado" for a in await _avisos(client, red["b"]["headers"]))

    async def test_otra_marca_no_avisa(self, client, red):
        await _radar(client, red["b"]["headers"], brand="Ford")

        await client.post("/vehicles", headers=red["a"]["headers"], json=AUTO)

        assert not any(a["entity_type"].startswith("radar_") for a in await _avisos(client, red["b"]["headers"]))

    @pytest.mark.parametrize("entrada", [
        {"brand": "Toyota", "max_price": 20000000},   # más caro que el presupuesto
        {"brand": "Toyota", "max_km": 50000},         # más km de los que acepta
        {"brand": "Toyota", "min_year": 2022},        # más viejo de lo que busca
    ])
    async def test_los_limites_se_respetan(self, client, red, entrada):
        await _radar(client, red["b"]["headers"], **entrada)

        await client.post("/vehicles", headers=red["a"]["headers"], json=AUTO)

        assert not any(a["entity_type"].startswith("radar_") for a in await _avisos(client, red["b"]["headers"]))

    async def test_la_dueña_no_se_avisa_a_si_misma(self, client, red):
        await _radar(client, red["a"]["headers"], brand="Toyota")

        await client.post("/vehicles", headers=red["a"]["headers"], json=AUTO)

        assert not any(a["entity_type"].startswith("radar_") for a in await _avisos(client, red["a"]["headers"]))


class TestLiquidacion:
    async def test_liquidar_avisa_con_el_precio_rebajado(self, client, red):
        """El auto entra en presupuestos donde antes no entraba: ese es el punto."""
        await _radar(client, red["b"]["headers"], brand="Toyota", max_price=21000000)

        creado = (await client.post("/vehicles", headers=red["a"]["headers"], json=AUTO)).json()
        assert not any(a["entity_type"].startswith("radar_") for a in await _avisos(client, red["b"]["headers"]))

        r = await client.patch(
            f"/vehicles/{creado['id']}/liquidar",
            headers=red["a"]["headers"], json={"liquidacion_price": 20000000},
        )
        assert r.status_code == 204, r.text

        avisos = await _avisos(client, red["b"]["headers"])
        assert any(a["entity_type"] == "radar_liquidacion" for a in avisos)


class TestPreToma:
    async def test_una_pre_toma_avisa_por_radar(self, client, red):
        await _radar(client, red["b"]["headers"], brand="Toyota")

        r = await client.post(
            "/vehicles", headers=red["a"]["headers"], json={**AUTO, "status": "pre_toma"}
        )
        assert r.status_code == 201

        assert any(a["entity_type"] == "radar_pre_toma" for a in await _avisos(client, red["b"]["headers"]))

    async def test_publicar_una_pre_toma_tambien_avisa(self, client, red):
        creado = (await client.post(
            "/vehicles", headers=red["a"]["headers"], json={**AUTO, "status": "pre_toma"}
        )).json()
        await _radar(client, red["b"]["headers"], brand="Toyota")

        r = await client.patch(
            f"/vehicles/{creado['id']}/status", headers=red["a"]["headers"],
            json={"status": "available"},
        )
        assert r.status_code == 200

        assert any(a["entity_type"] == "radar_publicado" for a in await _avisos(client, red["b"]["headers"]))


class TestSinDuplicados:
    async def test_una_conectada_con_radar_recibe_un_solo_aviso(self, client, red):
        """Si llegan los dos, el usuario ve el mismo auto dos veces y los silencia."""
        await client.post(f"/favorites/{red['b']['company']['id']}", headers=red["a"]["headers"])
        await client.post(f"/favorites/{red['a']['company']['id']}/accept", headers=red["b"]["headers"])
        await _radar(client, red["b"]["headers"], brand="Toyota")

        await client.post("/vehicles", headers=red["a"]["headers"], json=AUTO)

        avisos = await _avisos(client, red["b"]["headers"])
        del_auto = [a for a in avisos if a["entity_type"] in ("radar_publicado", "conectada_publicado")]
        assert len(del_auto) == 1
        assert del_auto[0]["entity_type"] == "radar_publicado", "gana el aviso que explica mejor"

    async def test_una_conectada_sin_radar_igual_se_entera(self, client, red):
        await client.post(f"/favorites/{red['b']['company']['id']}", headers=red["a"]["headers"])
        await client.post(f"/favorites/{red['a']['company']['id']}/accept", headers=red["b"]["headers"])

        await client.post("/vehicles", headers=red["a"]["headers"], json=AUTO)

        avisos = await _avisos(client, red["b"]["headers"])
        assert any(a["entity_type"] == "conectada_publicado" for a in avisos)
