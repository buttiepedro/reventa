from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session, require_super_admin
from app.core.config import settings
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.services.push import send_push

router = APIRouter()


class SubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(
    data: SubscribeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    existing = await session.execute(
        select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)
    )
    sub = existing.scalar_one_or_none()
    if sub:
        sub.p256dh = data.p256dh
        sub.auth = data.auth
        sub.user_id = current_user.id
        sub.company_id = current_user.company_id
    else:
        sub = PushSubscription(
            user_id=current_user.id,
            company_id=current_user.company_id,
            endpoint=data.endpoint,
            p256dh=data.p256dh,
            auth=data.auth,
            user_agent=request.headers.get("user-agent"),
        )
        session.add(sub)
    await session.flush()


@router.delete("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    data: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await session.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == data.endpoint,
            PushSubscription.user_id == current_user.id,
        )
    )


@router.post("/test", status_code=status.HTTP_204_NO_CONTENT)
async def send_test_push(
    current_user: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_session),
):
    if not settings.vapid_private_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="VAPID not configured")
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    await send_push(session, current_user.company_id, "Test push", "Push notifications are working!", "/")


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    return {"vapid_public_key": settings.vapid_public_key or None}
