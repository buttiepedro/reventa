import uuid
from math import ceil

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import s3
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

    async def create(self, company_id: uuid.UUID, data: VehicleCreate) -> Vehicle:
        vehicle = Vehicle(company_id=company_id, **data.model_dump())
        return await self.repo.save(vehicle)

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

    def _assert_owner(self, vehicle: Vehicle, company_id: uuid.UUID, is_super_admin: bool = False) -> None:
        if not is_super_admin and vehicle.company_id != company_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your vehicle")

    async def update(self, vehicle_id: uuid.UUID, company_id: uuid.UUID, data: VehicleUpdate, is_super_admin: bool = False) -> Vehicle:
        vehicle = await self.get_or_404(vehicle_id)
        self._assert_owner(vehicle, company_id, is_super_admin)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(vehicle, field, value)
        return await self.repo.save(vehicle)

    async def update_status(self, vehicle_id: uuid.UUID, company_id: uuid.UUID, data: VehicleStatusUpdate, is_super_admin: bool = False) -> Vehicle:
        vehicle = await self.get_or_404(vehicle_id)
        self._assert_owner(vehicle, company_id, is_super_admin)
        vehicle.status = data.status
        return await self.repo.save(vehicle)

    async def delete(self, vehicle_id: uuid.UUID, company_id: uuid.UUID, is_super_admin: bool = False) -> None:
        vehicle = await self.get_or_404(vehicle_id)
        self._assert_owner(vehicle, company_id, is_super_admin)
        await self.repo.delete(vehicle)

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
