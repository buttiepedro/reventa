from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.user import User
from app.schemas.sheet_config import SheetConfigRead, SheetConfigUpsert, SheetPreviewRequest, SheetPreviewResponse, SyncResult
from app.services.sheet_sync import SheetSyncService

router = APIRouter()


def _require_company(current_user: User) -> User:
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo usuarios de empresa")
    return current_user


@router.get("/config", response_model=SheetConfigRead | None)
async def get_config(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _require_company(current_user)
    config = await SheetSyncService(session).get_config(current_user.company_id)
    if config is None:
        return None
    return SheetConfigRead(
        sheet_url=config.sheet_url,
        column_mapping=config.column_mapping,
        has_header_row=config.has_header_row,
        last_synced_at=config.last_synced_at,
    )


@router.put("/config", response_model=SheetConfigRead)
async def save_config(
    data: SheetConfigUpsert,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _require_company(current_user)
    config = await SheetSyncService(session).upsert_config(current_user.company_id, data)
    return SheetConfigRead(
        sheet_url=config.sheet_url,
        column_mapping=config.column_mapping,
        has_header_row=config.has_header_row,
        last_synced_at=config.last_synced_at,
    )


@router.post("/preview", response_model=SheetPreviewResponse)
async def preview_sheet(
    data: SheetPreviewRequest,
    current_user: User = Depends(get_current_user),
    _session: AsyncSession = Depends(get_session),
):
    _require_company(current_user)
    try:
        return await SheetSyncService(_session).preview(data.url, data.has_header_row)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post("/sync", response_model=SyncResult)
async def sync_sheet(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _require_company(current_user)
    try:
        return await SheetSyncService(session).sync(current_user.company_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
