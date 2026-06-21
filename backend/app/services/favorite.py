import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.notification import Notification
from app.repositories.company import CompanyRepository
from app.repositories.company_favorite import CompanyFavoriteRepository
from app.schemas.company import CompanyRead
from app.schemas.favorite import FavoriteRequestRead


class FavoriteService:
    def __init__(self, session: AsyncSession) -> None:
        self.fav_repo = CompanyFavoriteRepository(session)
        self.company_repo = CompanyRepository(session)
        self.session = session

    async def _get_company_or_404(self, company_id: uuid.UUID) -> Company:
        c = await self.company_repo.get_by_id(company_id)
        if not c:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        return c

    async def _create_notification(self, company_id: uuid.UUID, title: str, body: str = "", entity_type: str | None = None, entity_id: uuid.UUID | None = None) -> None:
        notif = Notification(
            company_id=company_id,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        self.session.add(notif)
        await self.session.flush()

    async def get_confirmed(self, company_id: uuid.UUID) -> list[CompanyRead]:
        records = await self.fav_repo.get_confirmed(company_id)
        other_ids = [
            r.favorite_company_id if r.company_id == company_id else r.company_id
            for r in records
        ]
        if not other_ids:
            return []
        result = await self.session.execute(select(Company).where(Company.id.in_(other_ids)))
        return [CompanyRead.model_validate(c) for c in result.scalars().all()]

    # Legacy alias used by VehicleService
    async def get_favorites(self, company_id: uuid.UUID) -> list[CompanyRead]:
        return await self.get_confirmed(company_id)

    async def get_incoming_requests(self, company_id: uuid.UUID) -> list[FavoriteRequestRead]:
        records = await self.fav_repo.get_incoming_pending(company_id)
        result = []
        for r in records:
            requester = await self.company_repo.get_by_id(r.company_id)
            if requester:
                result.append(FavoriteRequestRead(
                    requester_id=r.company_id,
                    requester_name=requester.name,
                    created_at=r.created_at,
                ))
        return result

    async def get_outgoing_requests(self, company_id: uuid.UUID) -> list[FavoriteRequestRead]:
        records = await self.fav_repo.get_outgoing_pending(company_id)
        result = []
        for r in records:
            target = await self.company_repo.get_by_id(r.favorite_company_id)
            if target:
                result.append(FavoriteRequestRead(
                    requester_id=r.favorite_company_id,
                    requester_name=target.name,
                    created_at=r.created_at,
                ))
        return result

    async def send_request(self, from_id: uuid.UUID, to_id: uuid.UUID) -> None:
        if from_id == to_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No podés conectarte a vos mismo")
        await self._get_company_or_404(to_id)
        existing = await self.fav_repo.get_record(from_id, to_id)
        if existing:
            if existing.status == "accepted":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya son concesionarias conectadas")
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una solicitud pendiente")
        me = await self._get_company_or_404(from_id)
        await self.fav_repo.create_request(from_id, to_id)
        await self._create_notification(
            company_id=to_id,
            title=f"{me.name} te envió una solicitud de conexión",
            entity_type="favorite_request",
            entity_id=from_id,
        )

    async def accept_request(self, my_id: uuid.UUID, from_id: uuid.UUID) -> None:
        existing = await self.fav_repo.get_record(from_id, my_id)
        if not existing or existing.status != "pending":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
        me = await self._get_company_or_404(my_id)
        await self.fav_repo.accept(from_id, my_id)
        await self._create_notification(
            company_id=from_id,
            title=f"{me.name} aceptó tu solicitud de conexión",
            entity_type="favorite_accepted",
            entity_id=my_id,
        )

    async def remove(self, my_id: uuid.UUID, other_id: uuid.UUID) -> None:
        await self.fav_repo.remove(my_id, other_id)

    # Keep old name for backward compat
    async def add_favorite(self, company_id: uuid.UUID, target_id: uuid.UUID) -> None:
        await self.send_request(company_id, target_id)

    async def remove_favorite(self, company_id: uuid.UUID, target_id: uuid.UUID) -> None:
        await self.remove(company_id, target_id)
