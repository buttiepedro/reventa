import urllib.parse
import uuid
from datetime import datetime
from decimal import Decimal

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


# ─── Inbox ────────────────────────────────────────────────────


class InboxItem(BaseModel):
    id: uuid.UUID
    type: str
    offering_company_name: str
    offering_company_phone: str | None
    whatsapp_url: str | None
    vehicle_label: str
    vehicle_price: Decimal
    offer_id: uuid.UUID
    rank_score: Decimal | None
    created_at: datetime


def _wa_url(phone: str | None, vehicle_label: str, budget: Decimal) -> str | None:
    if not phone:
        return None
    text = (
        f"Hola! Vi la oferta de {vehicle_label} para mi búsqueda en La Lonja de Reventa "
        f"(presupuesto ${float(budget):,.0f}). ¿Podemos hablar?"
    )
    return f"https://wa.me/{phone.replace('+', '').replace(' ', '').replace('-', '')}?text={urllib.parse.quote(text)}"


@router.get("/inbox", response_model=list[InboxItem])
async def get_home_inbox(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        return []

    result = await session.execute(
        select(StockOffer)
        .join(ClientRequest, ClientRequest.id == StockOffer.client_request_id)
        .where(
            ClientRequest.company_id == current_user.company_id,
            StockOffer.status == "pending",
        )
        .order_by(StockOffer.created_at.desc())
        .limit(10)
    )
    offers = result.scalars().all()

    out = []
    for o in offers:
        await session.refresh(o, ["offering_company", "vehicle", "client_request"])
        wa = _wa_url(o.offering_company.phone, f"{o.vehicle.brand} {o.vehicle.model} {o.vehicle.year}", o.client_request.budget_max)
        out.append(InboxItem(
            id=o.id,
            type="lonja_offer",
            offering_company_name=o.offering_company.name,
            offering_company_phone=o.offering_company.phone,
            whatsapp_url=wa,
            vehicle_label=f"{o.vehicle.brand} {o.vehicle.model} {o.vehicle.year}",
            vehicle_price=o.vehicle.price_resale,
            offer_id=o.id,
            rank_score=o.rank_score,
            created_at=o.created_at,
        ))
    return out
