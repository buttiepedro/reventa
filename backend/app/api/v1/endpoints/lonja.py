import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.client_request import ClientRequest
from app.models.notification import Notification
from app.models.stock_offer import StockOffer
from app.models.vehicle import Vehicle, VehicleStatus
from app.schemas.lonja import ClientRequestCreate, ClientRequestRead, StockOfferCreate, StockOfferRead

router = APIRouter()

_REQUEST_TTL_DAYS = 7


def _rank_score(vehicle: Vehicle, request: ClientRequest) -> Decimal:
    price = float(vehicle.price_resale)
    budget_max = float(request.budget_max)
    budget_min = float(request.budget_min or 0)

    # Price fit: 0–70 pts
    if budget_min <= price <= budget_max:
        price_score = 70.0
    else:
        gap = min(abs(price - budget_max), abs(price - budget_min))
        price_score = max(0.0, 70.0 - (gap / budget_max) * 100)

    # Model match: +20 pts
    model_score = 0.0
    if request.reference_models:
        label = f"{vehicle.brand} {vehicle.model}".lower()
        for ref in request.reference_models:
            if ref.lower() in label or label in ref.lower():
                model_score = 20.0
                break

    # Recency: +10 pts scaled by year (2015–2026 range)
    recency_score = min(10.0, max(0.0, (vehicle.year - 2010) / 2))

    return Decimal(str(round(price_score + model_score + recency_score, 2)))


# ─── Client Requests ─────────────────────────────────────────


@router.get("/requests", response_model=list[ClientRequestRead])
async def list_open_requests(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(ClientRequest)
        .where(
            ClientRequest.status == "active",
            ClientRequest.expires_at > now,
            ClientRequest.company_id != current_user.company_id,
        )
        .order_by(ClientRequest.created_at.desc())
    )
    requests = result.scalars().all()
    out = []
    for r in requests:
        await session.refresh(r, ["company"])
        count = (await session.execute(
            select(func.count()).select_from(StockOffer).where(StockOffer.client_request_id == r.id)
        )).scalar_one()
        out.append(ClientRequestRead(
            **{k: v for k, v in r.__dict__.items() if not k.startswith("_") and k != "company"},
            company_name=r.company.name,
            offer_count=count,
        ))
    return out


@router.get("/my-requests", response_model=list[ClientRequestRead])
async def list_my_requests(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    result = await session.execute(
        select(ClientRequest)
        .where(ClientRequest.company_id == current_user.company_id)
        .order_by(ClientRequest.created_at.desc())
    )
    requests = result.scalars().all()
    out = []
    for r in requests:
        await session.refresh(r, ["company"])
        count = (await session.execute(
            select(func.count()).select_from(StockOffer).where(StockOffer.client_request_id == r.id)
        )).scalar_one()
        out.append(ClientRequestRead(
            **{k: v for k, v in r.__dict__.items() if not k.startswith("_") and k != "company"},
            company_name=r.company.name,
            offer_count=count,
        ))
    return out


@router.post("/requests", response_model=ClientRequestRead, status_code=status.HTTP_201_CREATED)
async def create_request(
    data: ClientRequestCreate,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    req = ClientRequest(
        company_id=current_user.company_id,
        budget_max=data.budget_max,
        budget_min=data.budget_min,
        payment_method=data.payment_method,
        category=data.category,
        reference_models=data.reference_models,
        filters={"notes": data.notes} if data.notes else None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=_REQUEST_TTL_DAYS),
    )
    session.add(req)
    await session.flush()
    await session.refresh(req, ["company"])
    return ClientRequestRead(
        **{k: v for k, v in req.__dict__.items() if not k.startswith("_") and k != "company"},
        company_name=req.company.name,
        offer_count=0,
    )


@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_request(
    request_id: uuid.UUID,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ClientRequest).where(
            ClientRequest.id == request_id,
            ClientRequest.company_id == current_user.company_id,
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    req.status = "cancelled"
    await session.flush()


# ─── Stock Offers ─────────────────────────────────────────────


@router.get("/requests/{request_id}/offers", response_model=list[StockOfferRead])
async def list_offers(
    request_id: uuid.UUID,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    req_result = await session.execute(select(ClientRequest).where(ClientRequest.id == request_id))
    req = req_result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if req.company_id != current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    result = await session.execute(
        select(StockOffer)
        .where(StockOffer.client_request_id == request_id)
        .order_by(StockOffer.rank_score.desc().nulls_last(), StockOffer.created_at.asc())
    )
    offers = result.scalars().all()
    out = []
    for o in offers:
        await session.refresh(o, ["offering_company", "vehicle"])
        out.append(StockOfferRead(
            **{k: v for k, v in o.__dict__.items() if not k.startswith("_") and k not in {"offering_company", "vehicle", "client_request"}},
            offering_company_name=o.offering_company.name,
            vehicle_label=f"{o.vehicle.brand} {o.vehicle.model} {o.vehicle.year}",
            vehicle_price=o.vehicle.price_resale,
        ))
    return out


@router.post("/requests/{request_id}/offers", response_model=StockOfferRead, status_code=status.HTTP_201_CREATED)
async def submit_offer(
    request_id: uuid.UUID,
    data: StockOfferCreate,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    req_result = await session.execute(select(ClientRequest).where(ClientRequest.id == request_id))
    req = req_result.scalar_one_or_none()
    if not req or req.status != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if req.company_id == current_user.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot offer on own request")

    veh_result = await session.execute(
        select(Vehicle).where(
            Vehicle.id == data.vehicle_id,
            Vehicle.company_id == current_user.company_id,
            Vehicle.status == VehicleStatus.AVAILABLE,
        )
    )
    vehicle = veh_result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found or not available")

    score = _rank_score(vehicle, req)
    offer = StockOffer(
        client_request_id=request_id,
        offering_company_id=current_user.company_id,
        vehicle_id=data.vehicle_id,
        message=data.message,
        rank_score=score,
    )
    session.add(offer)

    # Notify the request owner
    await session.refresh(req, ["company"])
    notif = Notification(
        company_id=req.company_id,
        title=f"Nueva oferta: {vehicle.brand} {vehicle.model} {vehicle.year}",
        body=f"Una agencia ofreció un vehículo para tu consulta de ${float(req.budget_max):,.0f}",
        entity_type="stock_offer",
        entity_id=offer.id,
    )
    session.add(notif)

    await session.flush()
    await session.refresh(offer, ["offering_company", "vehicle"])
    return StockOfferRead(
        **{k: v for k, v in offer.__dict__.items() if not k.startswith("_") and k not in {"offering_company", "vehicle", "client_request"}},
        offering_company_name=offer.offering_company.name,
        vehicle_label=f"{offer.vehicle.brand} {offer.vehicle.model} {offer.vehicle.year}",
        vehicle_price=offer.vehicle.price_resale,
    )


@router.patch("/offers/{offer_id}", response_model=StockOfferRead)
async def update_offer_status(
    offer_id: uuid.UUID,
    new_status: str,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(StockOffer).where(StockOffer.id == offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    req_result = await session.execute(select(ClientRequest).where(ClientRequest.id == offer.client_request_id))
    req = req_result.scalar_one_or_none()
    if not req or req.company_id != current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    if new_status not in ("accepted", "rejected"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST)

    offer.status = new_status
    await session.flush()
    await session.refresh(offer, ["offering_company", "vehicle"])
    return StockOfferRead(
        **{k: v for k, v in offer.__dict__.items() if not k.startswith("_") and k not in {"offering_company", "vehicle", "client_request"}},
        offering_company_name=offer.offering_company.name,
        vehicle_label=f"{offer.vehicle.brand} {offer.vehicle.model} {offer.vehicle.year}",
        vehicle_price=offer.vehicle.price_resale,
    )
