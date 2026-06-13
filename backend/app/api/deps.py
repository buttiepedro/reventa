import uuid
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import Role, User
from app.repositories.user import UserRepository

_bearer = HTTPBearer()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db():
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    try:
        user_id = uuid.UUID(decode_token(credentials.credentials))
    except (ValueError, Exception):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await UserRepository(session).get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin required")
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (Role.SUPER_ADMIN, Role.COMPANY_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return current_user
