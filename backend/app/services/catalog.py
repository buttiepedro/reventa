import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import VehicleMake, VehicleModel, VehicleTrim
from app.schemas.catalog import MakeWrite, ModelWrite, TrimWrite


class CatalogService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Makes ────────────────────────────────────────────────────
    async def get_makes(self) -> list[VehicleMake]:
        result = await self.session.execute(select(VehicleMake).order_by(VehicleMake.name))
        return list(result.scalars().all())

    async def create_make(self, data: MakeWrite) -> VehicleMake:
        make = VehicleMake(name=data.name.strip(), is_custom=True)
        self.session.add(make)
        await self.session.flush()
        await self.session.refresh(make)
        return make

    async def update_make(self, make_id: uuid.UUID, data: MakeWrite) -> VehicleMake:
        make = await self.session.get(VehicleMake, make_id)
        if not make:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Make not found")
        make.name = data.name.strip()
        await self.session.flush()
        await self.session.refresh(make)
        return make

    async def delete_make(self, make_id: uuid.UUID) -> None:
        make = await self.session.get(VehicleMake, make_id)
        if not make:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Make not found")
        await self.session.delete(make)
        await self.session.flush()

    # ── Models ───────────────────────────────────────────────────
    async def get_models(self, make_id: uuid.UUID) -> list[VehicleModel]:
        result = await self.session.execute(
            select(VehicleModel).where(VehicleModel.make_id == make_id).order_by(VehicleModel.name)
        )
        return list(result.scalars().all())

    async def create_model(self, data: ModelWrite) -> VehicleModel:
        model = VehicleModel(make_id=data.make_id, name=data.name.strip(), is_custom=True)
        self.session.add(model)
        await self.session.flush()
        await self.session.refresh(model)
        return model

    async def update_model(self, model_id: uuid.UUID, data: ModelWrite) -> VehicleModel:
        model = await self.session.get(VehicleModel, model_id)
        if not model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
        model.name = data.name.strip()
        await self.session.flush()
        await self.session.refresh(model)
        return model

    async def delete_model(self, model_id: uuid.UUID) -> None:
        model = await self.session.get(VehicleModel, model_id)
        if not model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
        await self.session.delete(model)
        await self.session.flush()

    # ── Trims ────────────────────────────────────────────────────
    async def get_trims(self, model_id: uuid.UUID) -> list[VehicleTrim]:
        result = await self.session.execute(
            select(VehicleTrim).where(VehicleTrim.model_id == model_id).order_by(VehicleTrim.name)
        )
        return list(result.scalars().all())

    async def create_trim(self, data: TrimWrite) -> VehicleTrim:
        trim = VehicleTrim(model_id=data.model_id, name=data.name.strip(), is_custom=True)
        self.session.add(trim)
        await self.session.flush()
        await self.session.refresh(trim)
        return trim

    async def update_trim(self, trim_id: uuid.UUID, data: TrimWrite) -> VehicleTrim:
        trim = await self.session.get(VehicleTrim, trim_id)
        if not trim:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trim not found")
        trim.name = data.name.strip()
        await self.session.flush()
        await self.session.refresh(trim)
        return trim

    async def delete_trim(self, trim_id: uuid.UUID) -> None:
        trim = await self.session.get(VehicleTrim, trim_id)
        if not trim:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trim not found")
        await self.session.delete(trim)
        await self.session.flush()
