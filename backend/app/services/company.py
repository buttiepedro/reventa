import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.repositories.company import CompanyRepository
from app.schemas.company import CompanyCreate, CompanyUpdate


class CompanyService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = CompanyRepository(session)

    async def create(self, data: CompanyCreate) -> Company:
        if await self.repo.get_by_slug(data.slug):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already taken")
        return await self.repo.save(Company(name=data.name, slug=data.slug))

    async def get_all(self) -> list[Company]:
        return await self.repo.get_all()

    async def get_or_404(self, company_id: uuid.UUID) -> Company:
        company = await self.repo.get_by_id(company_id)
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        return company

    async def update(self, company_id: uuid.UUID, data: CompanyUpdate) -> Company:
        company = await self.get_or_404(company_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(company, field, value)
        return await self.repo.save(company)

    async def delete(self, company_id: uuid.UUID) -> None:
        company = await self.get_or_404(company_id)
        await self.repo.delete(company)
