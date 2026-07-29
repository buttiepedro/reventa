from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.client_request import ClientRequest
from app.models.notification import Notification
from app.models.stock_offer import StockOffer
from app.models.vehicle import Vehicle, VehicleStatus

router = APIRouter()


class HomeStats(BaseModel):
    vehiculos_publicados: int
    consultas_recibidas: int
    ofertas_pendientes: int
    match_directos: int


@router.get("/stats", response_model=HomeStats)
async def get_home_stats(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        return HomeStats(vehiculos_publicados=0, consultas_recibidas=0, ofertas_pendientes=0, match_directos=0)

    cid = current_user.company_id

    vehiculos = (await session.execute(
        select(func.count()).select_from(Vehicle).where(
            Vehicle.company_id == cid,
            Vehicle.status == VehicleStatus.AVAILABLE,
        )
    )).scalar_one()

    consultas = (await session.execute(
        select(func.count()).select_from(ClientRequest).where(
            ClientRequest.company_id == cid,
            ClientRequest.status == "active",
        )
    )).scalar_one()

    ofertas = (await session.execute(
        select(func.count()).select_from(StockOffer)
        .join(ClientRequest, ClientRequest.id == StockOffer.client_request_id)
        .where(
            ClientRequest.company_id == cid,
            StockOffer.status == "pending",
        )
    )).scalar_one()

    matches = (await session.execute(
        select(func.count()).select_from(Notification).where(
            Notification.company_id == cid,
            Notification.entity_type == "lonja_match",
            Notification.is_read == False,  # noqa: E712
        )
    )).scalar_one()

    return HomeStats(
        vehiculos_publicados=vehiculos,
        consultas_recibidas=consultas,
        ofertas_pendientes=ofertas,
        match_directos=matches,
    )
