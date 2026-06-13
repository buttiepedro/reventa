import uuid

from sqlalchemy import select

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_company(self, company_id: uuid.UUID) -> list[User]:
        result = await self.session.execute(select(User).where(User.company_id == company_id))
        return list(result.scalars().all())
