import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session, require_admin
from app.core.security import hash_password, verify_password
from app.models.user import Role, User
from app.schemas.user import UserRead, UserUpdate
from app.services.user import UserService

router = APIRouter()


# ─── Audience PIN ────────────────────────────────────────────


class PinSet(BaseModel):
    pin: str


class PinVerify(BaseModel):
    pin: str


@router.put("/me/audience-pin", status_code=status.HTTP_204_NO_CONTENT)
async def set_audience_pin(
    data: PinSet,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not data.pin.isdigit() or not (4 <= len(data.pin) <= 8):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El PIN debe tener entre 4 y 8 dígitos numéricos")
    current_user.audience_pin_hash = hash_password(data.pin)
    await session.flush()


@router.post("/me/audience-pin/verify")
async def verify_audience_pin(
    data: PinVerify,
    current_user: User = Depends(get_current_user),
):
    if not current_user.audience_pin_hash:
        return {"valid": True}
    return {"valid": verify_password(data.pin, current_user.audience_pin_hash)}


@router.delete("/me/audience-pin", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audience_pin(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    current_user.audience_pin_hash = None
    await session.flush()


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user = await UserService(session).get_or_404(user_id)
    if current_user.role == Role.SUPER_ADMIN:
        return user
    if current_user.id == user_id:
        return user
    if current_user.role == Role.COMPANY_ADMIN and current_user.company_id == user.company_id:
        return user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)


@router.put("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    target = await UserService(session).get_or_404(user_id)
    if current_user.role == Role.SUPER_ADMIN:
        pass
    elif current_user.role == Role.COMPANY_ADMIN and current_user.company_id == target.company_id:
        pass
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return await UserService(session).update(user_id, data)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    await UserService(session).delete(user_id)
