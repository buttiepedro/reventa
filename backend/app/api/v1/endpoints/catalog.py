import asyncio
import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session, require_super_admin
from app.models.user import User
from app.schemas.catalog import MakeRead, MakeWrite, ModelRead, ModelWrite, SyncStatus, TrimRead, TrimWrite
from app.services import carapi_sync
from app.services.catalog import CatalogService

router = APIRouter()


# ── Public reads (all authenticated users) ──────────────────────

@router.get("/makes", response_model=list[MakeRead])
async def list_makes(
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await CatalogService(session).get_makes()


@router.get("/models", response_model=list[ModelRead])
async def list_models(
    make_id: uuid.UUID,
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await CatalogService(session).get_models(make_id)


@router.get("/trims", response_model=list[TrimRead])
async def list_trims(
    model_id: uuid.UUID,
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await CatalogService(session).get_trims(model_id)


# ── Super admin CRUD — Makes ─────────────────────────────────────

@router.post("/makes", response_model=MakeRead, status_code=status.HTTP_201_CREATED)
async def create_make(
    data: MakeWrite,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    return await CatalogService(session).create_make(data)


@router.put("/makes/{make_id}", response_model=MakeRead)
async def update_make(
    make_id: uuid.UUID,
    data: MakeWrite,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    return await CatalogService(session).update_make(make_id, data)


@router.delete("/makes/{make_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_make(
    make_id: uuid.UUID,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    await CatalogService(session).delete_make(make_id)


# ── Super admin CRUD — Models ────────────────────────────────────

@router.post("/models", response_model=ModelRead, status_code=status.HTTP_201_CREATED)
async def create_model(
    data: ModelWrite,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    return await CatalogService(session).create_model(data)


@router.put("/models/{model_id}", response_model=ModelRead)
async def update_model(
    model_id: uuid.UUID,
    data: ModelWrite,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    return await CatalogService(session).update_model(model_id, data)


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: uuid.UUID,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    await CatalogService(session).delete_model(model_id)


# ── Super admin CRUD — Trims ─────────────────────────────────────

@router.post("/trims", response_model=TrimRead, status_code=status.HTTP_201_CREATED)
async def create_trim(
    data: TrimWrite,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    return await CatalogService(session).create_trim(data)


@router.put("/trims/{trim_id}", response_model=TrimRead)
async def update_trim(
    trim_id: uuid.UUID,
    data: TrimWrite,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    return await CatalogService(session).update_trim(trim_id, data)


@router.delete("/trims/{trim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trim(
    trim_id: uuid.UUID,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    await CatalogService(session).delete_trim(trim_id)


# ── Sync ─────────────────────────────────────────────────────────

@router.post("/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_sync(_: User = Depends(require_super_admin)):
    asyncio.create_task(carapi_sync.run_sync())
    return {"detail": "Sincronización iniciada en segundo plano."}


@router.get("/sync/status", response_model=SyncStatus)
async def sync_status(_: User = Depends(require_super_admin)):
    return carapi_sync.get_sync_status()
