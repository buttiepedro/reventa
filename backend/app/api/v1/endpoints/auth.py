import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session, require_service_key
from app.core.security import create_service_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserRead
from app.services.auth import AuthService

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, session: AsyncSession = Depends(get_session)):
    return await AuthService(session).login(data)


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(data.new_password)
    session.add(current_user)


class ServiceTokenRequest(BaseModel):
    user_id: uuid.UUID


@router.post("/service-token", response_model=TokenResponse, include_in_schema=False)
async def service_token(
    data: ServiceTokenRequest,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_service_key),
):
    """Mint a short-lived token for the WhatsApp agent to act as one user.

    The agent never picks a tenant: it gets a normal user token and the existing
    per-request company scoping does the rest.
    """
    user = await UserRepository(session).get_by_id(data.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or inactive")
    return TokenResponse(access_token=create_service_token(str(user.id), svc="agent"))
