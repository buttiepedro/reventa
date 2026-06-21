import uuid

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company_favorite import CompanyFavorite


class CompanyFavoriteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_record(self, a: uuid.UUID, b: uuid.UUID) -> CompanyFavorite | None:
        """Get relationship record between two companies regardless of direction."""
        result = await self.session.execute(
            select(CompanyFavorite).where(
                or_(
                    (CompanyFavorite.company_id == a) & (CompanyFavorite.favorite_company_id == b),
                    (CompanyFavorite.company_id == b) & (CompanyFavorite.favorite_company_id == a),
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_confirmed(self, company_id: uuid.UUID) -> list[CompanyFavorite]:
        result = await self.session.execute(
            select(CompanyFavorite).where(
                or_(
                    CompanyFavorite.company_id == company_id,
                    CompanyFavorite.favorite_company_id == company_id,
                ),
                CompanyFavorite.status == "accepted",
            )
        )
        return list(result.scalars().all())

    async def get_confirmed_ids(self, company_id: uuid.UUID) -> list[uuid.UUID]:
        records = await self.get_confirmed(company_id)
        return [
            r.favorite_company_id if r.company_id == company_id else r.company_id
            for r in records
        ]

    async def get_incoming_pending(self, company_id: uuid.UUID) -> list[CompanyFavorite]:
        result = await self.session.execute(
            select(CompanyFavorite).where(
                CompanyFavorite.favorite_company_id == company_id,
                CompanyFavorite.status == "pending",
            )
        )
        return list(result.scalars().all())

    async def get_outgoing_pending(self, company_id: uuid.UUID) -> list[CompanyFavorite]:
        result = await self.session.execute(
            select(CompanyFavorite).where(
                CompanyFavorite.company_id == company_id,
                CompanyFavorite.status == "pending",
            )
        )
        return list(result.scalars().all())

    async def create_request(self, from_id: uuid.UUID, to_id: uuid.UUID) -> CompanyFavorite:
        record = CompanyFavorite(
            company_id=from_id,
            favorite_company_id=to_id,
            status="pending",
            requested_by_id=from_id,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def accept(self, from_id: uuid.UUID, to_id: uuid.UUID) -> None:
        result = await self.session.execute(
            select(CompanyFavorite).where(
                CompanyFavorite.company_id == from_id,
                CompanyFavorite.favorite_company_id == to_id,
                CompanyFavorite.status == "pending",
            )
        )
        record = result.scalar_one_or_none()
        if record:
            record.status = "accepted"
            await self.session.flush()

    async def remove(self, a: uuid.UUID, b: uuid.UUID) -> None:
        await self.session.execute(
            delete(CompanyFavorite).where(
                or_(
                    (CompanyFavorite.company_id == a) & (CompanyFavorite.favorite_company_id == b),
                    (CompanyFavorite.company_id == b) & (CompanyFavorite.favorite_company_id == a),
                )
            )
        )
        await self.session.flush()

    # Legacy method kept for VehicleService compatibility
    async def get_favorites(self, company_id: uuid.UUID) -> list[uuid.UUID]:
        return await self.get_confirmed_ids(company_id)

    async def is_favorite(self, company_id: uuid.UUID, target_id: uuid.UUID) -> bool:
        record = await self.get_record(company_id, target_id)
        return record is not None and record.status == "accepted"
