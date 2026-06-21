import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.user import Role, User
from app.schemas.company import CompanyRead
from app.schemas.favorite import FavoriteRequestRead
from app.services.favorite import FavoriteService

router = APIRouter()


def _get_company_id(current_user: User) -> uuid.UUID:
    if current_user.role == Role.SUPER_ADMIN or current_user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin has no company context for favorites")
    return current_user.company_id


@router.get("", response_model=list[CompanyRead])
async def list_confirmed(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = _get_company_id(current_user)
    return await FavoriteService(session).get_confirmed(company_id)


@router.get("/requests/incoming", response_model=list[FavoriteRequestRead])
async def list_incoming_requests(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = _get_company_id(current_user)
    return await FavoriteService(session).get_incoming_requests(company_id)


@router.get("/requests/outgoing", response_model=list[FavoriteRequestRead])
async def list_outgoing_requests(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = _get_company_id(current_user)
    return await FavoriteService(session).get_outgoing_requests(company_id)


@router.post("/{company_id}", status_code=status.HTTP_201_CREATED)
async def send_request(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    my_id = _get_company_id(current_user)
    await FavoriteService(session).send_request(my_id, company_id)
    return {"detail": "Solicitud enviada"}


@router.post("/{company_id}/accept", status_code=status.HTTP_200_OK)
async def accept_request(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    my_id = _get_company_id(current_user)
    await FavoriteService(session).accept_request(my_id, company_id)
    return {"detail": "Solicitud aceptada"}


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_or_reject(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    my_id = _get_company_id(current_user)
    await FavoriteService(session).remove(my_id, company_id)
