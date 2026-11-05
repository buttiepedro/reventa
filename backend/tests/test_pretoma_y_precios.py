"""Una pre-toma es un auto que la agencia NO se quiere quedar, y el historial de precios."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.price_point import VehiclePricePoint
from app.models.vehicle import Vehicle
from app.services import price_history
from tests.conftest import needs_db

pytestmark = needs_db

CUIT_A = "30712345671"
CUIT_B = "30712345689"

AUTO = {
    "brand": "Audi", "model": "S3", "year": 2017, "color": "negro", "mileage": 87000,
    "fuel_type": "gasoline", "transmission": "automatic", "condition": "used",
    "price_resale": 69750000, "price_public": 77500000,
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


class TestPreTomaFueraDelStock:
    async def test_no_aparece_en_mi_stock(self, client, red):
        """El bug reportado: pedían cargar una pre-toma y les aparecía en su stock."""
        await _crear(client, red["a"]["headers"], status="pre_toma")

        stock = (await client.get("/vehicles/my", headers=red["a"]["headers"])).json()
        assert all(v["status"] != "pre_toma" for v in stock)

    async def test_el_dueño_la_ve_en_su_propia_lista(self, client, red):
        """Tiene que poder ver quién marcó interés antes de que se venza."""
        creado = await _crear(client, red["a"]["headers"], status="pre_toma")

        mias = (await client.get("/vehicles/pre-toma/mias", headers=red["a"]["headers"])).json()
        assert [v["id"] for v in mias] == [creado["id"]]

    async def test_un_auto_disponible_si_esta_en_el_stock(self, client, red):
        creado = await _crear(client, red["a"]["headers"])

        stock = (await client.get("/vehicles/my", headers=red["a"]["headers"])).json()
        assert creado["id"] in [v["id"] for v in stock]


class TestVisibilidadEnLaRed:
    async def test_la_ve_una_agencia_sin_conexiones(self, client, red):
        """Antes sólo la veían las conectadas: una agencia sin conexiones no la veía."""
        creado = await _crear(client, red["a"]["headers"], status="pre_toma")

        feed = (await client.get("/vehicles/pre-toma", headers=red["b"]["headers"])).json()
        assert creado["id"] in [v["id"] for v in feed]

    async def test_la_dueña_no_se_la_ve_a_si_misma_en_el_feed(self, client, red):
        creado = await _crear(client, red["a"]["headers"], status="pre_toma")

        feed = (await client.get("/vehicles/pre-toma", headers=red["a"]["headers"])).json()
        assert creado["id"] not in [v["id"] for v in feed]


class TestVencimiento:
    async def test_una_vencida_desaparece_del_feed(self, client, red):
        creado = await _crear(client, red["a"]["headers"], status="pre_toma")
        async with AsyncSessionLocal() as s:
            v = await s.get(Vehicle, creado["id"])
            v.pre_toma_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            await s.commit()

        feed = (await client.get("/vehicles/pre-toma", headers=red["b"]["headers"])).json()
        assert creado["id"] not in [v["id"] for v in feed]

    async def test_vencer_no_la_convierte_en_stock_propio(self, client, red):
        """Antes pasaba a `available`: el auto que no querías tomar terminaba publicado."""
        creado = await _crear(client, red["a"]["headers"], status="pre_toma")
        async with AsyncSessionLocal() as s:
            v = await s.get(Vehicle, creado["id"])
            v.pre_toma_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            await s.commit()

        async with AsyncSessionLocal() as s:
            assert (await s.get(Vehicle, creado["id"])).status.value == "pre_toma"

        stock = (await client.get("/vehicles/my", headers=red["a"]["headers"])).json()
        assert creado["id"] not in [v["id"] for v in stock]

    async def test_el_registro_sobrevive_para_el_historial(self, client, red):
        creado = await _crear(client, red["a"]["headers"], status="pre_toma")
        async with AsyncSessionLocal() as s:
            assert await s.get(Vehicle, creado["id"]) is not None


class TestHistorialDePrecios:
    async def test_publicar_deja_un_punto(self, client, red):
        creado = await _crear(client, red["a"]["headers"])

        async with AsyncSessionLocal() as s:
            puntos = (await s.scalars(
                select(VehiclePricePoint).where(VehiclePricePoint.vehicle_id == creado["id"])
            )).all()
        assert [p.kind for p in puntos] == ["publicado"]
        assert puntos[0].brand == "Audi" and puntos[0].year == 2017

    async def test_vender_deja_otro_punto(self, client, red):
        creado = await _crear(client, red["a"]["headers"])

        await client.patch(f"/vehicles/{creado['id']}/status",
                           headers=red["a"]["headers"], json={"status": "sold"})

        async with AsyncSessionLocal() as s:
            kinds = [p.kind for p in (await s.scalars(
                select(VehiclePricePoint).where(VehiclePricePoint.vehicle_id == creado["id"])
            )).all()]
        assert sorted(kinds) == ["publicado", "vendido"]

    async def test_liquidar_guarda_el_precio_rebajado(self, client, red):
        creado = await _crear(client, red["a"]["headers"])

        await client.patch(f"/vehicles/{creado['id']}/liquidar",
                           headers=red["a"]["headers"], json={"liquidacion_price": 55000000})

        async with AsyncSessionLocal() as s:
            liq = (await s.scalars(select(VehiclePricePoint).where(
                VehiclePricePoint.vehicle_id == creado["id"],
                VehiclePricePoint.kind == "liquidado",
            ))).all()
        assert len(liq) == 1
        assert int(liq[0].price_resale) == 55000000

    async def test_el_punto_sobrevive_al_borrado_del_vehiculo(self, client, red):
        """El historial tiene que seguir diciendo qué valía ese auto."""
        creado = await _crear(client, red["a"]["headers"])
        await client.delete(f"/vehicles/{creado['id']}", headers=red["a"]["headers"])

        async with AsyncSessionLocal() as s:
            puntos = (await s.scalars(
                select(VehiclePricePoint).where(VehiclePricePoint.brand == "Audi")
            )).all()
        assert puntos, "se perdió el historial al borrar el auto"

    async def test_el_endpoint_devuelve_sugeridos(self, client, red):
        # Modelo propio del test: los puntos se acumulan en la base compartida y
        # los de otros tests contaminarían el recuento.
        modelo = f"S3-{red['tag']}"
        for km in (80000, 90000, 85000):
            await _crear(client, red["a"]["headers"], model=modelo, mileage=km)

        r = await client.get("/tasador/historial",
                             headers=red["b"]["headers"],
                             params={"brand": "Audi", "model": modelo, "year": 2017, "km": 87000})
        assert r.status_code == 200
        datos = r.json()
        assert datos["muestras"] == 3
        assert datos["sugerido_reventa"] is not None
        assert datos["sugerido_publico"] is not None


class TestSugerido:
    def test_los_liquidados_no_bajan_el_precio_de_referencia(self):
        """Una liquidación es una venta forzada, no el valor del auto."""
        def punto(kind, precio):
            return VehiclePricePoint(brand="Audi", model="S3", year=2017, mileage=80000,
                                     kind=kind, price_resale=precio, price_public=precio)

        datos = price_history.suggested(
            [punto("publicado", 70000000), punto("publicado", 72000000), punto("liquidado", 40000000)],
            km=80000,
        )
        assert datos["sugerido_reventa"] > 60000000
        assert datos["muestras"] == 2
        assert datos["muestras_liquidacion"] == 1

    def test_sin_muestras_suficientes_no_inventa(self):
        datos = price_history.suggested([], km=0)
        assert datos["sugerido_reventa"] is None
