"""Sync de marcas desde Mercado Libre."""

import httpx
import pytest
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.catalog import VehicleMake
from app.services import meli_sync
from tests.conftest import needs_db

pytestmark = needs_db

BRANDS = [{"id": "60297", "name": "Toyota"}, {"id": "67781", "name": "Fiat"}]


@pytest.fixture(autouse=True)
async def catalogo_limpio():
    """El nombre de marca es único y la base persiste entre tests: sin esto, el
    segundo test que inserte Toyota choca contra el primero."""
    from sqlalchemy import delete

    async with AsyncSessionLocal() as s:
        await s.execute(delete(VehicleMake))
        await s.commit()
    yield


@pytest.fixture
def sin_red(monkeypatch):
    """Evita salir a internet: el sync se prueba, no MELI."""
    async def fake_token(client):
        return "token-de-prueba"

    async def fake_brands(client, token):
        return BRANDS

    monkeypatch.setattr(meli_sync, "_get_token", fake_token)
    monkeypatch.setattr(meli_sync, "fetch_brands", fake_brands)


async def _names() -> set[str]:
    async with AsyncSessionLocal() as s:
        return {m.name for m in (await s.scalars(select(VehicleMake))).all()}


async def _get(name: str) -> VehicleMake | None:
    async with AsyncSessionLocal() as s:
        return await s.scalar(select(VehicleMake).where(VehicleMake.name == name))


async def test_trae_las_marcas(sin_red):
    await meli_sync.run_sync()

    assert {"Toyota", "Fiat"} <= await _names()
    assert meli_sync.get_sync_status().errors == []


async def test_correr_dos_veces_no_duplica(sin_red):
    await meli_sync.run_sync()
    primera = await _get("Toyota")
    await meli_sync.run_sync()

    async with AsyncSessionLocal() as s:
        cuantas = await s.scalar(
            select(func.count()).select_from(VehicleMake).where(VehicleMake.name == "Toyota")
        )
    assert cuantas == 1
    assert (await _get("Toyota")).id == primera.id


async def test_adopta_una_marca_cargada_a_mano(sin_red):
    """Las 68 marcas que ya existen no tienen id externo: hay que vincularlas, no duplicarlas."""
    async with AsyncSessionLocal() as s:
        s.add(VehicleMake(name="Toyota", is_custom=True))
        await s.commit()

    await meli_sync.run_sync()

    toyota = await _get("Toyota")
    assert toyota.external_id == "60297"
    assert toyota.is_custom is False
    assert len([n for n in await _names() if n == "Toyota"]) == 1


async def test_sin_credenciales_igual_trae_marcas(monkeypatch):
    """El endpoint de atributos de MELI responde sin autenticar."""
    monkeypatch.setattr(settings, "meli_client_id", "")
    monkeypatch.setattr(settings, "meli_client_secret", "")

    async def fake_brands(client, token):
        assert token is None
        return BRANDS

    monkeypatch.setattr(meli_sync, "fetch_brands", fake_brands)

    await meli_sync.run_sync()

    assert "Toyota" in await _names()
    status = meli_sync.get_sync_status()
    assert any("MELI_CLIENT_ID" in e for e in status.errors), "debería avisar que no hay credenciales"


async def test_un_rechazo_de_meli_se_reporta(monkeypatch):
    monkeypatch.setattr(settings, "meli_client_id", "x")
    monkeypatch.setattr(settings, "meli_client_secret", "y")

    async def fake_token(client):
        raise PermissionError("MELI rechazó las credenciales: HTTP 400")

    monkeypatch.setattr(meli_sync, "_get_token", fake_token)

    await meli_sync.run_sync()

    assert any("rechazó" in e for e in meli_sync.get_sync_status().errors)


async def test_una_marca_sin_nombre_no_rompe_el_resto(sin_red, monkeypatch):
    async def fake_brands(client, token):
        return [{"id": "1", "name": "   "}, *BRANDS]

    monkeypatch.setattr(meli_sync, "fetch_brands", fake_brands)

    await meli_sync.run_sync()

    assert {"Toyota", "Fiat"} <= await _names()


class TestContraMeliDeVerdad:
    """Pega contra la API pública. Se saltea si no hay red."""

    async def test_la_categoria_de_autos_sigue_trayendo_marcas(self):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                brands = await meli_sync.fetch_brands(client, None)
        except Exception as exc:  # noqa: BLE001
            pytest.skip(f"sin acceso a MELI: {exc}")

        names = {b["name"] for b in brands}
        assert len(brands) > 100
        assert {"Toyota", "Volkswagen", "Fiat", "Renault"} <= names
