import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.repositories.company import CompanyRepository
from app.repositories.company_favorite import CompanyFavoriteRepository
from app.schemas.company import CompanyRead


class FavoriteService:
    def __init__(self, session: AsyncSession) -> None:
        self.fav_repo = CompanyFavoriteRepository(session)
        self.company_repo = CompanyRepository(session)

    async def get_favorites(self, company_id: uuid.UUID) -> list[CompanyRead]:
        fav_ids = await self.fav_repo.get_favorites(company_id)
        if not fav_ids:
            return []
        result = await self.company_repo.session.execute(
            select(Company).where(Company.id.in_(fav_ids))
        )
        return [CompanyRead.model_validate(c) for c in result.scalars().all()]

    async def add_favorite(self, company_id: uuid.UUID, target_id: uuid.UUID) -> None:
        if company_id == target_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot favorite yourself")
        target = await self.company_repo.get_by_id(target_id)
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        await self.fav_repo.add(company_id, target_id)

    async def remove_favorite(self, company_id: uuid.UUID, target_id: uuid.UUID) -> None:
        await self.fav_repo.remove(company_id, target_id)
