import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import Role, User
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = UserRepository(session)

    async def create_in_company(self, company_id: uuid.UUID, data: UserCreate) -> User:
        if data.role == Role.SUPER_ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assign super_admin role")
        if await self.repo.get_by_email(data.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=data.role,
            company_id=company_id,
        )
        return await self.repo.save(user)

    async def get_by_company(self, company_id: uuid.UUID) -> list[User]:
        return await self.repo.get_by_company(company_id)

    async def get_or_404(self, user_id: uuid.UUID) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    async def update(self, user_id: uuid.UUID, data: UserUpdate) -> User:
        user = await self.get_or_404(user_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(user, field, value)
        return await self.repo.save(user)

    async def delete(self, user_id: uuid.UUID) -> None:
        user = await self.get_or_404(user_id)
        await self.repo.delete(user)
