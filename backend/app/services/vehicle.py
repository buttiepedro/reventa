import uuid
from datetime import datetime, timedelta, timezone
from math import ceil

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import s3
from app.models.notification import Notification
from app.models.vehicle import Vehicle, VehicleStatus
from app.repositories.company_favorite import CompanyFavoriteRepository
from app.repositories.vehicle import VehicleRepository
from app.repositories.vehicle_image import VehicleImageRepository
from app.schemas.vehicle import PaginatedResponse, VehicleCreate, VehicleFilters, VehicleListItem, VehicleRead, VehicleStatusUpdate, VehicleUpdate


class VehicleService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = VehicleRepository(session)
        self.image_repo = VehicleImageRepository(session)
        self.fav_repo = CompanyFavoriteRepository(session)
        self.session = session

    async def _build_read(self, vehicle: Vehicle, company_name: str, favorite_ids: list[uuid.UUID]) -> VehicleRead:
        images = []
        for img in vehicle.images:
            url = await s3.generate_view_url(img.s3_key)
            images.append({"id": img.id, "s3_key": img.s3_key, "url": url, "display_order": img.display_order, "is_primary": img.is_primary})

        _SKIP = {"images", "company"}
        return VehicleRead(
            **{k: v for k, v in vehicle.__dict__.items() if not k.startswith("_") and k not in _SKIP},
            company_name=company_name,
            images=images,
            is_favorite_company=vehicle.company_id in favorite_ids,
        )

    async def _notify_favorites_pre_toma(self, vehicle: Vehicle) -> None:
        confirmed_ids = await self.fav_repo.get_confirmed_ids(vehicle.company_id)
        for company_id in confirmed_ids:
            notif = Notification(
                company_id=company_id,
                title=f"Pre toma disponible: {vehicle.brand} {vehicle.model} {vehicle.year}",
                body="Una concesionaria conectada tiene un vehículo en pre toma. ¡Revisalo y marcá tu interés!",
                entity_type="pre_toma",
                entity_id=vehicle.id,
            )
            self.session.add(notif)
        if confirmed_ids:
            await self.session.flush()

    def _set_pretoma_expiry(self, vehicle: Vehicle) -> None:
        vehicle.pre_toma_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    async def create(self, company_id: uuid.UUID, data: VehicleCreate) -> Vehicle:
        vehicle = Vehicle(company_id=company_id, **data.model_dump())
        if vehicle.status == VehicleStatus.PRE_TOMA:
            self._set_pretoma_expiry(vehicle)
        saved = await self.repo.save(vehicle)
        if saved.status == VehicleStatus.PRE_TOMA:
            await self._notify_favorites_pre_toma(saved)
        return saved

    async def get_or_404(self, vehicle_id: uuid.UUID) -> Vehicle:
        v = await self.repo.get_by_id(vehicle_id)
        if not v:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        return v

    async def get_detail(self, vehicle_id: uuid.UUID, current_company_id: uuid.UUID) -> VehicleRead:
        vehicle = await self.get_or_404(vehicle_id)
        await self.repo.session.refresh(vehicle, ["images", "company"])
        fav_ids = await self.fav_repo.get_favorites(current_company_id)
        return await self._build_read(vehicle, vehicle.company.name, fav_ids)

    async def get_network_list(self, current_company_id: uuid.UUID, filters: VehicleFilters) -> PaginatedResponse[VehicleListItem]:
        fav_ids = await self.fav_repo.get_favorites(current_company_id)
        vehicles, total = await self.repo.get_network_list(current_company_id, fav_ids, filters)

        items = []
        for v in vehicles:
            await self.repo.session.refresh(v, ["images", "company"])
            primary = next((img for img in v.images if img.is_primary), v.images[0] if v.images else None)
            primary_url = await s3.generate_view_url(primary.s3_key) if primary else None
            items.append(
                VehicleListItem(
                    **{k: val for k, val in v.__dict__.items() if not k.startswith("_") and k not in {"images", "company"}},
                    company_name=v.company.name,
                    primary_image_url=primary_url,
                    is_favorite_company=v.company_id in fav_ids,
                )
            )

        return PaginatedResponse(
            items=items,
            total=total,
            page=filters.page,
            page_size=filters.page_size,
            pages=ceil(total / filters.page_size) if total else 0,
        )

    async def get_my_list(self, company_id: uuid.UUID) -> list[VehicleListItem]:
        vehicles = await self.repo.get_by_company(company_id)
        items = []
        for v in vehicles:
            await self.repo.session.refresh(v, ["images", "company"])
            primary = next((img for img in v.images if img.is_primary), v.images[0] if v.images else None)
            primary_url = await s3.generate_view_url(primary.s3_key) if primary else None
            items.append(
                VehicleListItem(
                    **{k: val for k, val in v.__dict__.items() if not k.startswith("_") and k not in {"images", "company"}},
                    company_name=v.company.name,
                    primary_image_url=primary_url,
                    is_favorite_company=False,
                )
            )
        return items

    async def get_pre_toma_for_company(self, company_id: uuid.UUID) -> list[VehicleListItem]:
        """Returns pre_toma vehicles from confirmed favorites of company_id."""
        confirmed_ids = await self.fav_repo.get_confirmed_ids(company_id)
        if not confirmed_ids:
            return []
        vehicles = await self.repo.get_pre_toma_by_companies(confirmed_ids)
        items = []
        for v in vehicles:
            await self.repo.session.refresh(v, ["images", "company"])
            primary = next((img for img in v.images if img.is_primary), v.images[0] if v.images else None)
            primary_url = await s3.generate_view_url(primary.s3_key) if primary else None
            items.append(
                VehicleListItem(
                    **{k: val for k, val in v.__dict__.items() if not k.startswith("_") and k not in {"images", "company"}},
                    company_name=v.company.name,
                    primary_image_url=primary_url,
                    is_favorite_company=True,
                )
            )
        return items

    def _assert_owner(self, vehicle: Vehicle, company_id: uuid.UUID, is_super_admin: bool = False) -> None:
        if not is_super_admin and vehicle.company_id != company_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your vehicle")

    async def update(self, vehicle_id: uuid.UUID, company_id: uuid.UUID, data: VehicleUpdate, is_super_admin: bool = False) -> Vehicle:
        vehicle = await self.get_or_404(vehicle_id)
        self._assert_owner(vehicle, company_id, is_super_admin)
        old_status = vehicle.status
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(vehicle, field, value)
        if vehicle.status == VehicleStatus.PRE_TOMA and old_status != VehicleStatus.PRE_TOMA:
            self._set_pretoma_expiry(vehicle)
        saved = await self.repo.save(vehicle)
        if saved.status == VehicleStatus.PRE_TOMA and old_status != VehicleStatus.PRE_TOMA:
            await self._notify_favorites_pre_toma(saved)
        return saved

    async def update_status(self, vehicle_id: uuid.UUID, company_id: uuid.UUID, data: VehicleStatusUpdate, is_super_admin: bool = False) -> Vehicle:
        vehicle = await self.get_or_404(vehicle_id)
        self._assert_owner(vehicle, company_id, is_super_admin)
        old_status = vehicle.status
        vehicle.status = data.status
        if vehicle.status == VehicleStatus.PRE_TOMA and old_status != VehicleStatus.PRE_TOMA:
            self._set_pretoma_expiry(vehicle)
        saved = await self.repo.save(vehicle)
        if saved.status == VehicleStatus.PRE_TOMA and old_status != VehicleStatus.PRE_TOMA:
            await self._notify_favorites_pre_toma(saved)
        return saved

    async def delete(self, vehicle_id: uuid.UUID, company_id: uuid.UUID, is_super_admin: bool = False) -> None:
        vehicle = await self.get_or_404(vehicle_id)
        self._assert_owner(vehicle, company_id, is_super_admin)
        await self.repo.delete(vehicle)

    @staticmethod
    async def expire_pretoma_ttl(session: AsyncSession) -> int:
        now = datetime.now(timezone.utc)
        result = await session.execute(
            select(Vehicle).where(
                Vehicle.status == VehicleStatus.PRE_TOMA,
                Vehicle.pre_toma_expires_at.isnot(None),
                Vehicle.pre_toma_expires_at <= now,
            )
        )
        expired = result.scalars().all()
        for v in expired:
            v.status = VehicleStatus.AVAILABLE
            v.pre_toma_expires_at = None
        if expired:
            await session.commit()
        return len(expired)

    async def get_public(self, share_token: uuid.UUID) -> dict:
        v = await self.repo.get_by_share_token(share_token)
        if not v:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        await self.repo.session.refresh(v, ["images"])
        images = []
        for img in v.images:
            url = await s3.generate_view_url(img.s3_key)
            images.append({"id": img.id, "s3_key": img.s3_key, "url": url, "display_order": img.display_order, "is_primary": img.is_primary})
        return {
            "brand": v.brand, "model": v.model, "year": v.year, "version": v.version,
            "color": v.color, "mileage": v.mileage, "fuel_type": v.fuel_type,
            "transmission": v.transmission, "condition": v.condition,
            "body_type": v.body_type, "description": v.description, "images": images,
        }
