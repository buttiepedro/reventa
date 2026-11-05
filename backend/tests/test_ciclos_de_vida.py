"""Los dos ciclos completos, verificados de punta a punta.

Liquidación:  stock → liquidación 72h → vuelve al stock con el precio de lista
Pre-toma:     nunca es stock → 24h en el feed de la red → se deshabilita
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.liquidacion import Liquidacion
from app.models.vehicle import Vehicle
from tests.conftest import needs_db

pytestmark = needs_db

CUIT_A = "30712345671"
CUIT_B = "30712345689"

PRECIO_LISTA = 25000000
PRECIO_LIQUIDACION = 20000000

AUTO = {
    "brand": "Toyota", "model": "Corolla", "year": 2019, "color": "gris", "mileage": 80000,
    "fuel_type": "gasoline", "transmission": "automatic", "condition": "used",
    "price_resale": PRECIO_LISTA, "price_public": 27000000,
}


@pytest.fixture
async def red(client, world, super_admin):
    for key, cuit in (("a", CUIT_A), ("b", CUIT_B)):
        await client.post("/companies/me/cuit", headers=world[key]["headers"], json={"cuit": cuit})
        await client.patch(
            f"/companies/admin/companies/{world[key]['company']['id']}/verify-cuit",
            headers=super_admin, json={"approved": True},
        )
    return world


async def _crear(client, headers, **extra):
    r = await client.post("/vehicles", headers=headers, json={**AUTO, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def _en_mi_stock(client, headers, vehicle_id) -> dict | None:
    stock = (await client.get("/vehicles/my", headers=headers)).json()
    return next((v for v in stock if v["id"] == vehicle_id), None)


async def _en_liquidaciones_de_la_red(client, headers, vehicle_id) -> bool:
    r = await client.get("/vehicles", headers=headers, params={"liquidaciones": True})
    return vehicle_id in [v["id"] for v in r.json()["items"]]


async def _vencer_liquidacion(vehicle_id):
    async with AsyncSessionLocal() as s:
        liq = await s.scalar(
            select(Liquidacion).where(Liquidacion.vehicle_id == vehicle_id, Liquidacion.status == "active")
        )
        liq.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        await s.commit()


class TestCicloDeLiquidacion:
    """Cargo a stock → pido liquidación (72h) → vuelve a stock con precio común."""

    async def test_el_ciclo_completo(self, client, red):
        headers = red["a"]["headers"]
        auto = await _crear(client, headers)

        # 1. En el stock, a precio de lista.
        en_stock = await _en_mi_stock(client, headers, auto["id"])
        assert en_stock is not None
        assert not en_stock["is_liquidacion"]
        assert int(float(en_stock["price_resale"])) == PRECIO_LISTA

        # 2. Liquidado: sigue en el stock, pero con el precio rebajado y visible
        #    en el listado de liquidaciones de la red.
        r = await client.patch(f"/vehicles/{auto['id']}/liquidar", headers=headers,
                               json={"liquidacion_price": PRECIO_LIQUIDACION})
        assert r.status_code == 204, r.text

        en_stock = await _en_mi_stock(client, headers, auto["id"])
        assert en_stock is not None, "liquidar no puede sacarlo del stock"
        assert en_stock["is_liquidacion"] is True
        assert int(float(en_stock["liquidacion_price"])) == PRECIO_LIQUIDACION
        assert await _en_liquidaciones_de_la_red(client, red["b"]["headers"], auto["id"])

        # 3. Pasadas las 72h vuelve al precio de lista, sin salir del stock.
        await _vencer_liquidacion(auto["id"])

        en_stock = await _en_mi_stock(client, headers, auto["id"])
        assert en_stock is not None, "al vencer la liquidación el auto desapareció del stock"
        assert not en_stock["is_liquidacion"], "sigue mostrándose como liquidación vencida"
        assert en_stock["liquidacion_price"] is None
        assert int(float(en_stock["price_resale"])) == PRECIO_LISTA, "se perdió el precio de lista"
        assert not await _en_liquidaciones_de_la_red(client, red["b"]["headers"], auto["id"])

    async def test_dura_72_horas(self, client, red):
        auto = await _crear(client, red["a"]["headers"])
        antes = datetime.now(timezone.utc)

        await client.patch(f"/vehicles/{auto['id']}/liquidar", headers=red["a"]["headers"],
                           json={"liquidacion_price": PRECIO_LIQUIDACION})

        async with AsyncSessionLocal() as s:
            liq = await s.scalar(select(Liquidacion).where(Liquidacion.vehicle_id == auto["id"]))
        duracion = liq.expires_at - antes
        assert timedelta(hours=71, minutes=55) < duracion < timedelta(hours=72, minutes=5)

    async def test_el_estado_del_vehiculo_nunca_cambia(self, client, red):
        """Liquidar es una oferta temporal sobre el mismo auto, no otro estado."""
        auto = await _crear(client, red["a"]["headers"])
        await client.patch(f"/vehicles/{auto['id']}/liquidar", headers=red["a"]["headers"],
                           json={"liquidacion_price": PRECIO_LIQUIDACION})

        async with AsyncSessionLocal() as s:
            assert (await s.get(Vehicle, auto["id"])).status.value == "available"

        await _vencer_liquidacion(auto["id"])
        async with AsyncSessionLocal() as s:
            v = await s.get(Vehicle, auto["id"])
            assert v.status.value == "available"
            assert int(v.price_resale) == PRECIO_LISTA

    async def test_vencida_sin_que_corra_el_job(self, client, red):
        """El filtro mira la fecha además del estado: si el scheduler no corrió,
        la liquidación vencida igual deja de aplicarse."""
        auto = await _crear(client, red["a"]["headers"])
        await client.patch(f"/vehicles/{auto['id']}/liquidar", headers=red["a"]["headers"],
                           json={"liquidacion_price": PRECIO_LIQUIDACION})
        await _vencer_liquidacion(auto["id"])

        async with AsyncSessionLocal() as s:
            liq = await s.scalar(select(Liquidacion).where(Liquidacion.vehicle_id == auto["id"]))
            assert liq.status == "active", "a propósito: el job no corrió"

        en_stock = await _en_mi_stock(client, red["a"]["headers"], auto["id"])
        assert not en_stock["is_liquidacion"]

    async def test_cancelar_a_mano_tambien_devuelve_el_precio(self, client, red):
        auto = await _crear(client, red["a"]["headers"])
        await client.patch(f"/vehicles/{auto['id']}/liquidar", headers=red["a"]["headers"],
                           json={"liquidacion_price": PRECIO_LIQUIDACION})

        r = await client.delete(f"/vehicles/{auto['id']}/liquidar", headers=red["a"]["headers"])
        assert r.status_code == 204

        en_stock = await _en_mi_stock(client, red["a"]["headers"], auto["id"])
        assert not en_stock["is_liquidacion"]
        assert int(float(en_stock["price_resale"])) == PRECIO_LISTA


class TestCicloDePreToma:
    """No aparece como stock → 24h en pre-tomas → se deshabilita."""

    async def test_el_ciclo_completo(self, client, red):
        propia, ajena = red["a"]["headers"], red["b"]["headers"]
        auto = await _crear(client, propia, status="pre_toma")

        # 1. Nunca es stock propio.
        assert await _en_mi_stock(client, propia, auto["id"]) is None

        # 2. Está en el feed de pre-tomas de la red, y no en el stock de la red.
        feed = (await client.get("/vehicles/pre-toma", headers=ajena)).json()
        assert auto["id"] in [v["id"] for v in feed]

        red_stock = (await client.get("/vehicles", headers=ajena)).json()["items"]
        assert auto["id"] not in [v["id"] for v in red_stock], "una pre-toma no es stock de la red"

        # 3. A las 24 horas se deshabilita: no la ve nadie, ni vuelve al stock.
        async with AsyncSessionLocal() as s:
            v = await s.get(Vehicle, auto["id"])
            v.pre_toma_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            await s.commit()

        feed = (await client.get("/vehicles/pre-toma", headers=ajena)).json()
        assert auto["id"] not in [v["id"] for v in feed]
        assert await _en_mi_stock(client, propia, auto["id"]) is None
        red_stock = (await client.get("/vehicles", headers=ajena)).json()["items"]
        assert auto["id"] not in [v["id"] for v in red_stock]

    async def test_dura_24_horas(self, client, red):
        antes = datetime.now(timezone.utc)
        auto = await _crear(client, red["a"]["headers"], status="pre_toma")

        async with AsyncSessionLocal() as s:
            v = await s.get(Vehicle, auto["id"])
        duracion = v.pre_toma_expires_at - antes
        assert timedelta(hours=23, minutes=55) < duracion < timedelta(hours=24, minutes=5)

    async def test_quedarsela_la_convierte_en_stock(self, client, red):
        """El único camino de pre-toma a stock es que el dueño lo decida."""
        propia = red["a"]["headers"]
        auto = await _crear(client, propia, status="pre_toma")

        r = await client.patch(f"/vehicles/{auto['id']}/status", headers=propia,
                               json={"status": "available"})
        assert r.status_code == 200

        en_stock = await _en_mi_stock(client, propia, auto["id"])
        assert en_stock is not None
        assert int(float(en_stock["price_resale"])) == PRECIO_LISTA
