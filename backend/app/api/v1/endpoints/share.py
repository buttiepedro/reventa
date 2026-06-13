import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.vehicle import VehiclePublic
from app.services.vehicle import VehicleService

router = APIRouter()


@router.get("/{share_token}", response_model=VehiclePublic)
async def get_public_vehicle(
    share_token: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    return await VehicleService(session).get_public(share_token)
