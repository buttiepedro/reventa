import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.user import Role, User
from app.schemas.company import CompanyRead
from app.services.favorite import FavoriteService

router = APIRouter()


def _get_company_id(current_user: User) -> uuid.UUID:
    if current_user.role == Role.SUPER_ADMIN or current_user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin has no company context for favorites")
    return current_user.company_id


@router.get("", response_model=list[CompanyRead])
async def list_favorites(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = _get_company_id(current_user)
    return await FavoriteService(session).get_favorites(company_id)


@router.post("/{company_id}", status_code=status.HTTP_201_CREATED)
async def add_favorite(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    my_id = _get_company_id(current_user)
    await FavoriteService(session).add_favorite(my_id, company_id)
    return {"detail": "Added to favorites"}


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    my_id = _get_company_id(current_user)
    await FavoriteService(session).remove_favorite(my_id, company_id)
