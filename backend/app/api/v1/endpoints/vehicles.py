import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.notification import Notification
from app.models.pre_toma_interest import PreTomaInterest
from app.models.user import Role, User
from app.models.vehicle import VehicleStatus
from app.schemas.vehicle import (
    PaginatedResponse,
    VehicleCreate,
    VehicleFilters,
    VehicleListItem,
    VehicleRead,
    VehicleStatusUpdate,
    VehicleUpdate,
)
from app.schemas.vehicle_image import UploadUrlResponse, VehicleImageCreate, VehicleImageRead
from app.services.vehicle import VehicleService
from app.services.vehicle_image import VehicleImageService

router = APIRouter()


class PreTomaInterestRead(BaseModel):
    company_id: uuid.UUID
    company_name: str
    created_at: datetime


# ─── Network listing ─────────────────────────────────────────


@router.get("", response_model=PaginatedResponse[VehicleListItem])
async def list_network_vehicles(
    brand: Annotated[str | None, Query()] = None,
    model: Annotated[str | None, Query()] = None,
    year_min: Annotated[int | None, Query()] = None,
    year_max: Annotated[int | None, Query()] = None,
    fuel_type: Annotated[str | None, Query()] = None,
    transmission: Annotated[str | None, Query()] = None,
    condition: Annotated[str | None, Query()] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = "available",
    company_id: Annotated[uuid.UUID | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from app.models.vehicle import FuelType, Transmission, VehicleCondition, VehicleStatus

    filters = VehicleFilters(
        brand=brand,
        model=model,
        year_min=year_min,
        year_max=year_max,
        fuel_type=FuelType(fuel_type) if fuel_type else None,
        transmission=Transmission(transmission) if transmission else None,
        condition=VehicleCondition(condition) if condition else None,
        status=VehicleStatus(status_filter) if status_filter else None,
        company_id=company_id,
        page=page,
        page_size=page_size,
    )
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company users only")
    return await VehicleService(session).get_network_list(current_user.company_id, filters)


@router.get("/my", response_model=list[VehicleListItem])
async def list_my_vehicles(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company users only")
    return await VehicleService(session).get_my_list(current_user.company_id)


# ─── CRUD ────────────────────────────────────────────────────


@router.post("", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    data: VehicleCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    assert current_user.company_id is not None
    svc = VehicleService(session)
    vehicle = await svc.create(current_user.company_id, data)
    return await svc.get_detail(vehicle.id, current_user.company_id)


@router.get("/{vehicle_id}", response_model=VehicleRead)
async def get_vehicle(
    vehicle_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = current_user.company_id or uuid.uuid4()
    return await VehicleService(session).get_detail(vehicle_id, company_id)


@router.put("/{vehicle_id}", response_model=VehicleRead)
async def update_vehicle(
    vehicle_id: uuid.UUID,
    data: VehicleUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    is_super = current_user.role == Role.SUPER_ADMIN
    company_id = current_user.company_id or uuid.uuid4()
    svc = VehicleService(session)
    vehicle = await svc.update(vehicle_id, company_id, data, is_super_admin=is_super)
    return await svc.get_detail(vehicle.id, company_id)


@router.patch("/{vehicle_id}/status", response_model=VehicleRead)
async def update_vehicle_status(
    vehicle_id: uuid.UUID,
    data: VehicleStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    is_super = current_user.role == Role.SUPER_ADMIN
    company_id = current_user.company_id or uuid.uuid4()
    svc = VehicleService(session)
    vehicle = await svc.update_status(vehicle_id, company_id, data, is_super_admin=is_super)
    return await svc.get_detail(vehicle.id, company_id)


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    is_super = current_user.role == Role.SUPER_ADMIN
    company_id = current_user.company_id or uuid.uuid4()
    await VehicleService(session).delete(vehicle_id, company_id, is_super_admin=is_super)


# ─── Images ──────────────────────────────────────────────────


@router.post("/{vehicle_id}/images/upload-url", response_model=UploadUrlResponse)
async def get_image_upload_url(
    vehicle_id: uuid.UUID,
    filename: Annotated[str, Query()],
    content_type: Annotated[str, Query()] = "image/jpeg",
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    is_super = current_user.role == Role.SUPER_ADMIN
    company_id = current_user.company_id or uuid.uuid4()
    return await VehicleImageService(session).get_upload_url(vehicle_id, company_id, filename, content_type, is_super)


@router.post("/{vehicle_id}/images/upload", response_model=VehicleImageRead, status_code=status.HTTP_201_CREATED)
async def upload_image(
    vehicle_id: uuid.UUID,
    file: UploadFile = File(...),
    display_order: int = 0,
    is_primary: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    is_super = current_user.role == Role.SUPER_ADMIN
    company_id = current_user.company_id or uuid.uuid4()
    return await VehicleImageService(session).upload_image(vehicle_id, company_id, file, display_order, is_primary, is_super)


@router.post("/{vehicle_id}/images", response_model=VehicleImageRead, status_code=status.HTTP_201_CREATED)
async def register_image(
    vehicle_id: uuid.UUID,
    data: VehicleImageCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    is_super = current_user.role == Role.SUPER_ADMIN
    company_id = current_user.company_id or uuid.uuid4()
    return await VehicleImageService(session).register_image(vehicle_id, company_id, data, is_super)


@router.delete("/{vehicle_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    vehicle_id: uuid.UUID,
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    is_super = current_user.role == Role.SUPER_ADMIN
    company_id = current_user.company_id or uuid.uuid4()
    await VehicleImageService(session).delete_image(image_id, company_id, is_super)


@router.patch("/{vehicle_id}/images/{image_id}/primary", response_model=VehicleImageRead)
async def set_primary_image(
    vehicle_id: uuid.UUID,
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    is_super = current_user.role == Role.SUPER_ADMIN
    company_id = current_user.company_id or uuid.uuid4()
    return await VehicleImageService(session).set_primary(image_id, vehicle_id, company_id, is_super)


# ─── Pre Toma ────────────────────────────────────────────────


@router.get("/pre-toma", response_model=list[VehicleListItem])
async def list_pre_toma(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company users only")
    return await VehicleService(session).get_pre_toma_for_company(current_user.company_id)


@router.post("/{vehicle_id}/interest", status_code=status.HTTP_201_CREATED)
async def add_interest(
    vehicle_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company users only")
    vehicle = await VehicleService(session).get_or_404(vehicle_id)
    if vehicle.status != VehicleStatus.PRE_TOMA:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vehicle is not in pre_toma status")
    existing = await session.execute(
        select(PreTomaInterest).where(
            PreTomaInterest.vehicle_id == vehicle_id,
            PreTomaInterest.company_id == current_user.company_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"detail": "Ya marcaste interés"}
    interest = PreTomaInterest(vehicle_id=vehicle_id, company_id=current_user.company_id)
    session.add(interest)
    # Notify vehicle owner
    await session.refresh(vehicle, ["company"])
    notif = Notification(
        company_id=vehicle.company_id,
        title=f"{vehicle.company.name if hasattr(vehicle, 'company') and vehicle.company else 'Una concesionaria'} está interesada en tu pre toma {vehicle.brand} {vehicle.model}",
        entity_type="pre_toma_interest",
        entity_id=vehicle_id,
    )
    session.add(notif)
    return {"detail": "Interés registrado"}


@router.delete("/{vehicle_id}/interest", status_code=status.HTTP_204_NO_CONTENT)
async def remove_interest(
    vehicle_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company users only")
    await session.execute(
        delete(PreTomaInterest).where(
            PreTomaInterest.vehicle_id == vehicle_id,
            PreTomaInterest.company_id == current_user.company_id,
        )
    )


@router.get("/{vehicle_id}/interests", response_model=list[PreTomaInterestRead])
async def list_interests(
    vehicle_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    vehicle = await VehicleService(session).get_or_404(vehicle_id)
    company_id = current_user.company_id or uuid.uuid4()
    if current_user.role != Role.SUPER_ADMIN and vehicle.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your vehicle")
    result = await session.execute(
        select(PreTomaInterest).where(PreTomaInterest.vehicle_id == vehicle_id)
    )
    interests = result.scalars().all()
    from app.repositories.company import CompanyRepository
    company_repo = CompanyRepository(session)
    out = []
    for i in interests:
        c = await company_repo.get_by_id(i.company_id)
        if c:
            out.append(PreTomaInterestRead(company_id=i.company_id, company_name=c.name, created_at=i.created_at))
    return out
