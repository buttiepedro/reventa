import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import s3
from app.models.vehicle_image import VehicleImage
from app.repositories.vehicle import VehicleRepository
from app.repositories.vehicle_image import VehicleImageRepository
from app.schemas.vehicle_image import UploadUrlResponse, VehicleImageCreate, VehicleImageRead


class VehicleImageService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = VehicleImageRepository(session)
        self.vehicle_repo = VehicleRepository(session)

    def _assert_owner(self, vehicle_company_id: uuid.UUID, company_id: uuid.UUID, is_super_admin: bool) -> None:
        if not is_super_admin and vehicle_company_id != company_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your vehicle")

    async def get_upload_url(
        self, vehicle_id: uuid.UUID, company_id: uuid.UUID, filename: str, content_type: str, is_super_admin: bool = False
    ) -> UploadUrlResponse:
        vehicle = await self.vehicle_repo.get_by_id(vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        self._assert_owner(vehicle.company_id, company_id, is_super_admin)

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        s3_key = f"vehicles/{vehicle_id}/{uuid.uuid4()}.{ext}"
        upload_url = await s3.generate_upload_url(s3_key, content_type)
        return UploadUrlResponse(upload_url=upload_url, s3_key=s3_key)

    async def register_image(
        self, vehicle_id: uuid.UUID, company_id: uuid.UUID, data: VehicleImageCreate, is_super_admin: bool = False
    ) -> VehicleImageRead:
        vehicle = await self.vehicle_repo.get_by_id(vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        self._assert_owner(vehicle.company_id, company_id, is_super_admin)

        if data.is_primary:
            await self.repo.clear_primary(vehicle_id)

        image = VehicleImage(vehicle_id=vehicle_id, **data.model_dump())
        saved = await self.repo.save(image)
        url = await s3.generate_view_url(saved.s3_key)
        return VehicleImageRead(id=saved.id, s3_key=saved.s3_key, url=url, display_order=saved.display_order, is_primary=saved.is_primary)

    async def delete_image(self, image_id: uuid.UUID, company_id: uuid.UUID, is_super_admin: bool = False) -> None:
        image = await self.repo.get_by_id(image_id)
        if not image:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
        vehicle = await self.vehicle_repo.get_by_id(image.vehicle_id)
        if vehicle:
            self._assert_owner(vehicle.company_id, company_id, is_super_admin)
        await self.repo.delete(image)

    async def set_primary(self, image_id: uuid.UUID, vehicle_id: uuid.UUID, company_id: uuid.UUID, is_super_admin: bool = False) -> VehicleImageRead:
        image = await self.repo.get_by_id(image_id)
        if not image or image.vehicle_id != vehicle_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
        vehicle = await self.vehicle_repo.get_by_id(vehicle_id)
        if vehicle:
            self._assert_owner(vehicle.company_id, company_id, is_super_admin)
        await self.repo.clear_primary(vehicle_id)
        image.is_primary = True
        saved = await self.repo.save(image)
        url = await s3.generate_view_url(saved.s3_key)
        return VehicleImageRead(id=saved.id, s3_key=saved.s3_key, url=url, display_order=saved.display_order, is_primary=saved.is_primary)
