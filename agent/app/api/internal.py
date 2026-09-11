"""Endpoints the Reventa backend calls on the user's behalf. Never public."""

import secrets
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.services import linking, notify

router = APIRouter()


async def require_service_key(x_service_key: str = Header(default="")) -> None:
    if not settings.agent_service_key or not secrets.compare_digest(
        x_service_key, settings.agent_service_key
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service key")


class LinkRequest(BaseModel):
    user_id: uuid.UUID


class NotificationsToggle(BaseModel):
    enabled: bool


class NotifyRequest(BaseModel):
    user_ids: list[uuid.UUID]
    template: str
    params: dict = {}


@router.post("/links", dependencies=[Depends(require_service_key)])
async def create_link(data: LinkRequest, session: AsyncSession = Depends(get_db)):
    code, expires_at = await linking.start_link(session, data.user_id)
    return {
        "code": code,
        "expires_at": expires_at.isoformat(),
        "whatsapp_number": settings.meta_display_number or None,
    }


@router.get("/links/{user_id}", dependencies=[Depends(require_service_key)])
async def get_link(user_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    return await linking.status(session, user_id)


@router.delete("/links/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_service_key)])
async def delete_link(user_id: uuid.UUID, session: AsyncSession = Depends(get_db)) -> None:
    await linking.revoke(session, user_id)


@router.patch("/links/{user_id}/notifications", dependencies=[Depends(require_service_key)])
async def toggle_notifications(
    user_id: uuid.UUID, data: NotificationsToggle, session: AsyncSession = Depends(get_db)
):
    await notify.set_enabled(session, user_id, data.enabled)
    return {"notifications_enabled": data.enabled}


@router.post("/notify", dependencies=[Depends(require_service_key)])
async def send_notification(data: NotifyRequest, session: AsyncSession = Depends(get_db)):
    """Called by the backend when something happened that users asked to hear about."""
    return await notify.notify_users(session, data.user_ids, data.template, data.params)
