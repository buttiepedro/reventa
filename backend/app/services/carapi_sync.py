import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.catalog import VehicleMake, VehicleModel, VehicleTrim
from app.schemas.catalog import SyncStatus

logger = logging.getLogger(__name__)

CARAPI_BASE = "https://carapi.app/api"

# Module-level state (single FastAPI process)
_last_status: SyncStatus = SyncStatus()
_running = False
_lock = asyncio.Lock()


def get_sync_status() -> SyncStatus:
    return _last_status


async def _get_jwt(client: httpx.AsyncClient) -> str | None:
    if not settings.carapi_username or not settings.carapi_api_token:
        return None
    resp = await client.post(
        f"{CARAPI_BASE}/auth/login",
        json={"username": settings.carapi_username, "api_token": settings.carapi_api_token},
    )
    if resp.status_code != 200:
        raise ValueError(f"carapi auth failed: HTTP {resp.status_code}")
    return resp.json().get("token")


async def _fetch_all(client: httpx.AsyncClient, url: str, headers: dict) -> list[dict]:
    items: list[dict] = []
    page = 1
    while True:
        sep = "&" if "?" in url else "?"
        resp = await client.get(f"{url}{sep}limit=1000&page={page}", headers=headers)
        if resp.status_code == 403:
            break  # auth required but not provided
        resp.raise_for_status()
        body = resp.json()
        data = body.get("data", [])
        items.extend(data)
        if not data or page >= body.get("pages", 1):
            break
        page += 1
    return items


async def _upsert_make(session: AsyncSession, item: dict) -> bool:
    carapi_id: int = item["id"]
    name: str = item["name"].strip()
    result = await session.execute(select(VehicleMake).where(VehicleMake.carapi_id == carapi_id))
    existing = result.scalar_one_or_none()
    if existing:
        existing.name = name
        session.add(existing)
        return False
    # Also check by name (might exist as custom)
    by_name = await session.execute(select(VehicleMake).where(VehicleMake.name == name))
    existing_by_name = by_name.scalar_one_or_none()
    if existing_by_name:
        existing_by_name.carapi_id = carapi_id
        session.add(existing_by_name)
        return False
    session.add(VehicleMake(name=name, carapi_id=carapi_id, is_custom=False))
    return True


async def _upsert_model(session: AsyncSession, item: dict, make_uuid: dict[int, "VehicleMake"]) -> bool:
    carapi_id: int = item["id"]
    name: str = item.get("name", "").strip()
    make_carapi_id: int = item.get("make_id", 0)
    if not name or make_carapi_id not in make_uuid:
        return False
    make = make_uuid[make_carapi_id]
    result = await session.execute(select(VehicleModel).where(VehicleModel.carapi_id == carapi_id))
    existing = result.scalar_one_or_none()
    if existing:
        existing.name = name
        session.add(existing)
        return False
    result2 = await session.execute(
        select(VehicleModel).where(VehicleModel.make_id == make.id, VehicleModel.name == name)
    )
    if result2.scalar_one_or_none():
        return False
    session.add(VehicleModel(make_id=make.id, name=name, carapi_id=carapi_id, is_custom=False))
    return True


async def _upsert_trim(session: AsyncSession, item: dict, model_by_carapi: dict[int, "VehicleModel"]) -> bool:
    carapi_id: int = item["id"]
    name: str = (item.get("name") or item.get("description") or "").strip()
    model_carapi_id: int = item.get("model_id", 0)
    if not name or model_carapi_id not in model_by_carapi:
        return False
    model = model_by_carapi[model_carapi_id]
    result = await session.execute(select(VehicleTrim).where(VehicleTrim.carapi_id == carapi_id))
    existing = result.scalar_one_or_none()
    if existing:
        existing.name = name
        session.add(existing)
        return False
    result2 = await session.execute(
        select(VehicleTrim).where(VehicleTrim.model_id == model.id, VehicleTrim.name == name)
    )
    if result2.scalar_one_or_none():
        return False
    session.add(VehicleTrim(model_id=model.id, name=name, carapi_id=carapi_id, is_custom=False))
    return True


async def run_sync() -> None:
    global _running, _last_status
    async with _lock:
        if _running:
            return
        _running = True
        _last_status = SyncStatus(running=True)

    makes_count = models_count = trims_count = 0
    errors: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            jwt = await _get_jwt(client)
            auth_headers = {"Authorization": f"Bearer {jwt}"} if jwt else {}

            # Step 1: Sync makes (public endpoint)
            make_items = await _fetch_all(client, f"{CARAPI_BASE}/makes", {})
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    make_by_carapi: dict[int, VehicleMake] = {}
                    for item in make_items:
                        try:
                            created = await _upsert_make(session, item)
                            if created:
                                makes_count += 1
                        except Exception as exc:
                            errors.append(f"Make {item.get('name')}: {exc}")

                    # Re-fetch makes to build carapi_id → DB object map
                    result = await session.execute(select(VehicleMake).where(VehicleMake.carapi_id.isnot(None)))
                    for m in result.scalars().all():
                        if m.carapi_id is not None:
                            make_by_carapi[m.carapi_id] = m

            # Step 2: Sync models (requires auth)
            if jwt and make_by_carapi:
                model_by_carapi: dict[int, VehicleModel] = {}
                for make in make_by_carapi.values():
                    try:
                        model_items = await _fetch_all(
                            client,
                            f"{CARAPI_BASE}/models?make_id={make.carapi_id}",
                            auth_headers,
                        )
                        async with AsyncSessionLocal() as session:
                            async with session.begin():
                                for item in model_items:
                                    try:
                                        created = await _upsert_model(session, item, {make.carapi_id: make})
                                        if created:
                                            models_count += 1
                                    except Exception as exc:
                                        errors.append(f"Model {item.get('name')}: {exc}")
                    except Exception as exc:
                        errors.append(f"Fetching models for make {make.name}: {exc}")

                # Step 3: Sync trims per model
                async with AsyncSessionLocal() as session:
                    result = await session.execute(select(VehicleModel).where(VehicleModel.carapi_id.isnot(None)))
                    all_models = result.scalars().all()
                    for m in all_models:
                        if m.carapi_id is not None:
                            model_by_carapi[m.carapi_id] = m

                for model in model_by_carapi.values():
                    try:
                        trim_items = await _fetch_all(
                            client,
                            f"{CARAPI_BASE}/trims?model_id={model.carapi_id}",
                            auth_headers,
                        )
                        if not trim_items:
                            continue
                        async with AsyncSessionLocal() as session:
                            async with session.begin():
                                for item in trim_items:
                                    try:
                                        created = await _upsert_trim(session, item, {model.carapi_id: model})
                                        if created:
                                            trims_count += 1
                                    except Exception as exc:
                                        errors.append(f"Trim {item.get('name')}: {exc}")
                    except Exception as exc:
                        errors.append(f"Fetching trims for model {model.name}: {exc}")

    except Exception as exc:
        logger.exception("carapi sync failed")
        errors.append(f"Sync error: {exc}")
    finally:
        async with _lock:
            _running = False
            _last_status = SyncStatus(
                makes=makes_count,
                models=models_count,
                trims=trims_count,
                errors=errors[:50],
                last_run_at=datetime.now(timezone.utc),
                running=False,
            )
