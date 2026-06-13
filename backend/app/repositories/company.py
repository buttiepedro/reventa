from sqlalchemy import select

from app.models.company import Company
from app.repositories.base import BaseRepository


class CompanyRepository(BaseRepository[Company]):
    model = Company

    async def get_by_slug(self, slug: str) -> Company | None:
        result = await self.session.execute(select(Company).where(Company.slug == slug))
        return result.scalar_one_or_none()
