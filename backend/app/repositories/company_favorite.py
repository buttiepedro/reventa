import uuid

from sqlalchemy import delete, select

from app.models.company_favorite import CompanyFavorite
from app.core.database import Base
from sqlalchemy.ext.asyncio import AsyncSession


class CompanyFavoriteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_favorites(self, company_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.session.execute(
            select(CompanyFavorite.favorite_company_id).where(CompanyFavorite.company_id == company_id)
        )
        return list(result.scalars().all())

    async def is_favorite(self, company_id: uuid.UUID, target_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(CompanyFavorite).where(
                CompanyFavorite.company_id == company_id,
                CompanyFavorite.favorite_company_id == target_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def add(self, company_id: uuid.UUID, target_id: uuid.UUID) -> None:
        if not await self.is_favorite(company_id, target_id):
            self.session.add(CompanyFavorite(company_id=company_id, favorite_company_id=target_id))
            await self.session.flush()

    async def remove(self, company_id: uuid.UUID, target_id: uuid.UUID) -> None:
        await self.session.execute(
            delete(CompanyFavorite).where(
                CompanyFavorite.company_id == company_id,
                CompanyFavorite.favorite_company_id == target_id,
            )
        )
        await self.session.flush()
