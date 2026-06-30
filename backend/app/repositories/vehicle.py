import uuid
from typing import Sequence

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.vehicle import Vehicle, VehicleStatus
from app.repositories.base import BaseRepository
from app.schemas.vehicle import VehicleFilters


def _haversine_km(lat1: float, lon1: float, lat2_col, lon2_col):
    dlat = func.radians(lat2_col - lat1)
    dlon = func.radians(lon2_col - lon1)
    a = (
        func.power(func.sin(dlat / 2.0), 2)
        + func.cos(func.radians(lat1))
        * func.cos(func.radians(lat2_col))
        * func.power(func.sin(dlon / 2.0), 2)
    )
    return 6371.0 * 2.0 * func.asin(func.sqrt(a))


class VehicleRepository(BaseRepository[Vehicle]):
    model = Vehicle

    async def get_by_share_token(self, share_token: uuid.UUID) -> Vehicle | None:
        result = await self.session.execute(select(Vehicle).where(Vehicle.share_token == share_token))
        return result.scalar_one_or_none()

    async def get_by_company(self, company_id: uuid.UUID) -> list[Vehicle]:
        result = await self.session.execute(
            select(Vehicle).where(Vehicle.company_id == company_id).order_by(Vehicle.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_pre_toma_by_companies(self, company_ids: list[uuid.UUID]) -> list[Vehicle]:
        result = await self.session.execute(
            select(Vehicle)
            .where(Vehicle.status == VehicleStatus.PRE_TOMA, Vehicle.company_id.in_(company_ids))
            .order_by(Vehicle.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_network_list(
        self,
        current_company_id: uuid.UUID,
        favorite_ids: Sequence[uuid.UUID],
        filters: VehicleFilters,
        viewer_lat: float | None = None,
        viewer_lng: float | None = None,
    ) -> tuple[list[Vehicle], int]:
        use_geo = viewer_lat is not None and viewer_lng is not None

        stmt = select(Vehicle)
        if use_geo:
            stmt = stmt.join(Company, Vehicle.company_id == Company.id)

        if filters.status is not None:
            stmt = stmt.where(Vehicle.status == filters.status)
        if filters.brand:
            stmt = stmt.where(Vehicle.brand.ilike(f"%{filters.brand}%"))
        if filters.model:
            stmt = stmt.where(Vehicle.model.ilike(f"%{filters.model}%"))
        if filters.year_min:
            stmt = stmt.where(Vehicle.year >= filters.year_min)
        if filters.year_max:
            stmt = stmt.where(Vehicle.year <= filters.year_max)
        if filters.fuel_type:
            stmt = stmt.where(Vehicle.fuel_type == filters.fuel_type)
        if filters.transmission:
            stmt = stmt.where(Vehicle.transmission == filters.transmission)
        if filters.condition:
            stmt = stmt.where(Vehicle.condition == filters.condition)
        if filters.company_id:
            stmt = stmt.where(Vehicle.company_id == filters.company_id)

        count_result = await self.session.execute(select(func.count()).select_from(stmt.subquery()))
        total = count_result.scalar_one()

        # Favorites first; if viewer has geo → order by distance; else newest
        is_fav = case((Vehicle.company_id.in_(favorite_ids), 0), else_=1) if favorite_ids else case((Vehicle.id == Vehicle.id, 1), else_=1)  # noqa: E501
        if use_geo:
            dist = _haversine_km(viewer_lat, viewer_lng, Company.lat, Company.lng)  # type: ignore[arg-type]
            stmt = stmt.order_by(is_fav, dist.nulls_last(), Vehicle.created_at.desc())
        else:
            stmt = stmt.order_by(is_fav, Vehicle.created_at.desc())

        stmt = stmt.offset((filters.page - 1) * filters.page_size).limit(filters.page_size)

        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total
