import uuid

from sqlalchemy import select, update

from app.models.vehicle_image import VehicleImage
from app.repositories.base import BaseRepository


class VehicleImageRepository(BaseRepository[VehicleImage]):
    model = VehicleImage

    async def get_by_vehicle(self, vehicle_id: uuid.UUID) -> list[VehicleImage]:
        result = await self.session.execute(
            select(VehicleImage)
            .where(VehicleImage.vehicle_id == vehicle_id)
            .order_by(VehicleImage.display_order)
        )
        return list(result.scalars().all())

    async def clear_primary(self, vehicle_id: uuid.UUID) -> None:
        await self.session.execute(
            update(VehicleImage)
            .where(VehicleImage.vehicle_id == vehicle_id)
            .values(is_primary=False)
        )
