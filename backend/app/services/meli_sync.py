"""Sincroniza las marcas de vehículos desde Mercado Libre Argentina.

Sólo marcas, a propósito. La API de MELI expone la lista de modelos como un
arreglo plano de 2770 nombres sin decir a qué marca pertenece cada uno, y el
atributo de versiones viene sin valores: la relación vive en el flujo de
publicación del vendedor, no en la API de aplicación. Se verificó contra siete
rutas distintas con un token válido.

Por eso el modelo y la versión de un vehículo son texto libre, y el catálogo de
modelos se va a construir a partir de lo que carguen las agencias (ver el change
`catalogo-unificacion-modelos` en openspec).

El endpoint de atributos de categoría responde sin autenticación; el token sólo
se pide si hay credenciales, y su ausencia no rompe la sincronización.
"""

import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.catalog import VehicleMake
from app.schemas.catalog import SyncStatus

logger = logging.getLogger(__name__)

MELI_BASE = "https://api.mercadolibre.com"
# "Autos y Camionetas" en el sitio de Argentina.
CATEGORY_ID = "MLA1744"

_last_status: SyncStatus = SyncStatus()
_running = False
_lock = asyncio.Lock()


def get_sync_status() -> SyncStatus:
    return _last_status


async def _get_token(client: httpx.AsyncClient) -> str | None:
    """Token de aplicación. Devuelve None si no hay credenciales: las marcas se
    pueden leer igual sin autenticar."""
    if not settings.meli_client_id or not settings.meli_client_secret:
        return None
    resp = await client.post(
        f"{MELI_BASE}/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": settings.meli_client_id,
            "client_secret": settings.meli_client_secret,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if resp.status_code != 200:
        raise PermissionError(f"MELI rechazó las credenciales: HTTP {resp.status_code} {resp.text[:200]}")
    return resp.json().get("access_token")


async def fetch_brands(client: httpx.AsyncClient, token: str | None) -> list[dict]:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    resp = await client.get(f"{MELI_BASE}/categories/{CATEGORY_ID}/attributes", headers=headers)
    resp.raise_for_status()
    brand_attr = next((a for a in resp.json() if a.get("id") == "BRAND"), None)
    if brand_attr is None:
        raise ValueError("MELI no devolvió el atributo BRAND para la categoría de vehículos")
    return brand_attr.get("values") or []


async def _upsert_brand(session: AsyncSession, item: dict) -> bool:
    """Devuelve True si creó la marca. Las cargadas a mano se adoptan por nombre
    en vez de duplicarse."""
    external_id = str(item["id"])
    name = item["name"].strip()
    if not name:
        return False

    by_external = await session.scalar(
        select(VehicleMake).where(VehicleMake.external_id == external_id)
    )
    if by_external:
        by_external.name = name
        return False

    by_name = await session.scalar(select(VehicleMake).where(VehicleMake.name == name))
    if by_name:
        by_name.external_id = external_id
        by_name.is_custom = False
        return False

    session.add(VehicleMake(name=name, external_id=external_id, is_custom=False))
    return True


async def run_sync() -> None:
    global _running, _last_status
    async with _lock:
        if _running:
            return
        _running = True
        _last_status = SyncStatus(running=True)

    created = 0
    errors: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            token = await _get_token(client)
            if token is None:
                errors.append(
                    "Sin MELI_CLIENT_ID / MELI_CLIENT_SECRET: las marcas se traen igual, "
                    "pero sin credenciales no hay token para futuras llamadas autenticadas."
                )
            brands = await fetch_brands(client, token)

        async with AsyncSessionLocal() as session:
            async with session.begin():
                for item in brands:
                    try:
                        if await _upsert_brand(session, item):
                            created += 1
                    except Exception as exc:  # noqa: BLE001 — una marca mala no corta el resto
                        errors.append(f"Marca {item.get('name')}: {exc}")

        if not brands:
            errors.append("MELI devolvió cero marcas; el catálogo quedó como estaba.")
    except Exception as exc:  # noqa: BLE001
        logger.exception("meli sync failed")
        errors.append(f"Error de sincronización: {exc}")
    finally:
        async with _lock:
            _running = False
            _last_status = SyncStatus(
                makes=created,
                models=0,
                trims=0,
                errors=errors[:50],
                last_run_at=datetime.now(timezone.utc),
                running=False,
            )
