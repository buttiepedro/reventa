from statistics import mean

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.vehicle import Vehicle, VehicleStatus
from pydantic import BaseModel

router = APIRouter()


class ValuationResult(BaseModel):
    brand: str
    model: str
    year: int
    km: int
    suggested_price: float | None
    market_min: float | None
    market_max: float | None
    sample_count: int
    price_samples: list[float]
    source: str


def _trimmed_mean(values: list[float], trim_pct: float = 0.1) -> float:
    if not values:
        return 0.0
    sorted_v = sorted(values)
    cut = max(1, int(len(sorted_v) * trim_pct))
    trimmed = sorted_v[cut:-cut] if len(sorted_v) > 2 * cut else sorted_v
    return mean(trimmed)


@router.get("/valuate", response_model=ValuationResult)
async def valuate(
    brand: str = Query(...),
    model: str = Query(...),
    year: int = Query(...),
    km: int = Query(...),
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Search network for matching vehicles (±2 years)
    result = await session.execute(
        select(Vehicle).where(
            Vehicle.status == VehicleStatus.AVAILABLE,
            Vehicle.brand.ilike(f"%{brand}%"),
            Vehicle.model.ilike(f"%{model}%"),
            Vehicle.year >= year - 2,
            Vehicle.year <= year + 2,
        )
    )
    vehicles = result.scalars().all()

    prices = [float(v.price_resale) for v in vehicles]

    # Apply km adjustment: +2% per 10k km below network avg, -2% above
    if prices and km > 0:
        avg_km = sum(float(v.mileage) for v in vehicles) / len(vehicles)
        km_delta = (avg_km - km) / 10_000
        km_factor = 1 + (km_delta * 0.02)
        prices = [p * km_factor for p in prices]

    if len(prices) < 2:
        return ValuationResult(
            brand=brand, model=model, year=year, km=km,
            suggested_price=None, market_min=None, market_max=None,
            sample_count=len(prices), price_samples=prices, source="network",
        )

    suggested = _trimmed_mean(prices)
    return ValuationResult(
        brand=brand, model=model, year=year, km=km,
        suggested_price=round(suggested, 2),
        market_min=round(min(prices), 2),
        market_max=round(max(prices), 2),
        sample_count=len(prices),
        price_samples=sorted(prices),
        source="network",
    )
