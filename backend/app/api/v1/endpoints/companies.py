import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session, require_super_admin
from app.models.user import Role, User
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate
from app.schemas.user import UserCreate, UserRead
from app.services.company import CompanyService
from app.services.user import UserService

router = APIRouter()


@router.get("", response_model=list[CompanyRead])
async def list_companies(
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    return await CompanyService(session).get_all()


@router.post("", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
async def create_company(
    data: CompanyCreate,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    return await CompanyService(session).create(data)


@router.get("/{company_id}", response_model=CompanyRead)
async def get_company(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != Role.SUPER_ADMIN and current_user.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return await CompanyService(session).get_or_404(company_id)


@router.put("/{company_id}", response_model=CompanyRead)
async def update_company(
    company_id: uuid.UUID,
    data: CompanyUpdate,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    return await CompanyService(session).update(company_id, data)


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: uuid.UUID,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    await CompanyService(session).delete(company_id)


# ─── Company users ───────────────────────────────────────────


@router.get("/{company_id}/users", response_model=list[UserRead])
async def list_company_users(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != Role.SUPER_ADMIN and current_user.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return await UserService(session).get_by_company(company_id)


@router.post("/{company_id}/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_company_user(
    company_id: uuid.UUID,
    data: UserCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current_user.role == Role.COMPANY_USER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    if current_user.role == Role.COMPANY_ADMIN and current_user.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    await CompanyService(session).get_or_404(company_id)
    return await UserService(session).create_in_company(company_id, data)
