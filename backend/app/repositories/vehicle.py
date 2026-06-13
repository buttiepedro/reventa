import uuid
from typing import Sequence

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehicle import Vehicle, VehicleStatus
from app.repositories.base import BaseRepository
from app.schemas.vehicle import VehicleFilters


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

    async def get_network_list(
        self,
        current_company_id: uuid.UUID,
        favorite_ids: Sequence[uuid.UUID],
        filters: VehicleFilters,
    ) -> tuple[list[Vehicle], int]:
        stmt = select(Vehicle)

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

        # Favorites first, then newest
        is_favorite = case((Vehicle.company_id.in_(favorite_ids), 0), else_=1) if favorite_ids else case((Vehicle.id == Vehicle.id, 1), else_=1)  # noqa: E501
        stmt = (
            stmt.order_by(is_favorite, Vehicle.created_at.desc())
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total
