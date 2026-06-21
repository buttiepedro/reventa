import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.notification import Notification
from app.models.user import Role, User
from app.schemas.notification import NotificationCount, NotificationRead

router = APIRouter()


def _company_id(user: User) -> uuid.UUID | None:
    if user.role == Role.SUPER_ADMIN:
        return None
    return user.company_id


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    cid = _company_id(current_user)
    if not cid:
        return []
    result = await session.execute(
        select(Notification)
        .where(Notification.company_id == cid)
        .order_by(Notification.created_at.desc())
        .limit(30)
    )
    return [NotificationRead.model_validate(n) for n in result.scalars().all()]


@router.get("/count", response_model=NotificationCount)
async def count_unread(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    cid = _company_id(current_user)
    if not cid:
        return NotificationCount(unread=0)
    result = await session.execute(
        select(Notification).where(Notification.company_id == cid, Notification.is_read == False)  # noqa: E712
    )
    return NotificationCount(unread=len(result.scalars().all()))


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    cid = _company_id(current_user)
    if not cid:
        return
    await session.execute(
        update(Notification)
        .where(Notification.company_id == cid, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )


@router.patch("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    cid = _company_id(current_user)
    if not cid:
        return
    await session.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.company_id == cid)
        .values(is_read=True)
    )
