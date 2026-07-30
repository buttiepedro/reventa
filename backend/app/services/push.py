import asyncio
import json
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.push_subscription import PushSubscription


async def send_push(
    session: AsyncSession,
    company_id: uuid.UUID,
    title: str,
    body: str,
    url: str = "/",
) -> None:
    if not settings.vapid_private_key or not settings.vapid_public_key:
        return

    result = await session.execute(
        select(PushSubscription).where(PushSubscription.company_id == company_id)
    )
    subs = result.scalars().all()
    if not subs:
        return

    payload = json.dumps({"title": title, "body": body, "url": url}).encode()
    gone_endpoints: list[str] = []

    for sub in subs:
        try:
            await asyncio.to_thread(
                _webpush_sync,
                endpoint=sub.endpoint,
                p256dh=sub.p256dh,
                auth=sub.auth,
                payload=payload,
            )
        except Exception as exc:
            if "410" in str(exc) or "404" in str(exc):
                gone_endpoints.append(sub.endpoint)

    if gone_endpoints:
        await session.execute(
            delete(PushSubscription).where(PushSubscription.endpoint.in_(gone_endpoints))
        )


def _webpush_sync(endpoint: str, p256dh: str, auth: str, payload: bytes) -> None:
    from pywebpush import webpush  # type: ignore[import]

    webpush(
        subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
        data=payload,
        vapid_private_key=settings.vapid_private_key,
        vapid_claims={"sub": f"mailto:{settings.vapid_claim_email}"},
    )
