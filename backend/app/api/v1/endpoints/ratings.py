import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.company import Company
from app.models.company_rating import CompanyRating
from app.models.notification import Notification

router = APIRouter()


class RatingCreate(BaseModel):
    rated_company_id: uuid.UUID
    entity_type: str  # "lonja_offer" | "pre_toma"
    entity_id: uuid.UUID
    rating: int
    comment: str | None = None

    @field_validator("rating")
    @classmethod
    def valid_rating(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Rating must be between 1 and 5")
        return v

    @field_validator("entity_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in ("lonja_offer", "pre_toma"):
            raise ValueError("entity_type must be lonja_offer or pre_toma")
        return v


class RatingItem(BaseModel):
    id: uuid.UUID
    rater_company_id: uuid.UUID
    rater_name: str
    rating: int
    comment: str | None
    created_at: datetime


class RatingSummary(BaseModel):
    avg_rating: float | None
    total_ratings: int
    reputation_score: int | None
    recent: list[RatingItem]


def _recalc_reputation(avg: float | None, count: int) -> int | None:
    if avg is None or count < 3:
        return None
    if avg >= 4.0:
        return 2  # verde
    if avg >= 3.0:
        return 1  # amarillo
    return 0  # rojo


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_rating(
    data: RatingCreate,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    if data.rated_company_id == current_user.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No podés calificarte a vos mismo")

    # Prevent double rating
    existing = (await session.execute(
        select(CompanyRating).where(
            CompanyRating.rater_company_id == current_user.company_id,
            CompanyRating.entity_type == data.entity_type,
            CompanyRating.entity_id == data.entity_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya calificaste esta operación")

    cr = CompanyRating(
        rater_company_id=current_user.company_id,
        rated_company_id=data.rated_company_id,
        rating=data.rating,
        comment=data.comment,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
    )
    session.add(cr)
    await session.flush()

    # Recalculate avg_rating and reputation_score on rated company
    result = await session.execute(
        select(
            func.avg(CompanyRating.rating).label("avg"),
            func.count(CompanyRating.id).label("cnt"),
        ).where(CompanyRating.rated_company_id == data.rated_company_id)
    )
    row = result.one()
    new_avg = float(row.avg) if row.avg is not None else None
    new_count = int(row.cnt)

    rated = (await session.execute(
        select(Company).where(Company.id == data.rated_company_id)
    )).scalar_one_or_none()
    if rated:
        rated.avg_rating = Decimal(str(round(new_avg, 1))) if new_avg else None
        rated.total_ratings = new_count
        rated.reputation_score = _recalc_reputation(new_avg, new_count)

    return {"detail": "Calificación registrada"}


@router.get("/{company_id}", response_model=RatingSummary)
async def get_ratings(
    company_id: uuid.UUID,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    company = (await session.execute(
        select(Company).where(Company.id == company_id)
    )).scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    rows = (await session.execute(
        select(CompanyRating)
        .where(CompanyRating.rated_company_id == company_id)
        .order_by(CompanyRating.created_at.desc())
        .limit(20)
    )).scalars().all()

    recent = []
    for r in rows:
        await session.refresh(r, ["rater"])
        recent.append(RatingItem(
            id=r.id,
            rater_company_id=r.rater_company_id,
            rater_name=r.rater.name,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
        ))

    return RatingSummary(
        avg_rating=float(company.avg_rating) if company.avg_rating else None,
        total_ratings=company.total_ratings,
        reputation_score=company.reputation_score,
        recent=recent,
    )


@router.post("/notify-pending/{offer_id}", include_in_schema=False)
async def _internal_notify_rating(offer_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    """Internal use — called from lonja when offer accepted."""
    pass
