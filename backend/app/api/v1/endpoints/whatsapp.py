"""Thin proxy between the app and the WhatsApp agent service.

The agent owns the link state (it needs it on every inbound message, with no user
session around). The app only needs to start, inspect and revoke a link, so these
endpoints forward to the agent instead of duplicating that table here.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter()

_TIMEOUT = 10.0


class LinkCodeResponse(BaseModel):
    code: str
    expires_at: str
    whatsapp_number: str | None = None


class LinkStatusResponse(BaseModel):
    linked: bool
    phone_masked: str | None = None
    verified_at: str | None = None
    notifications_enabled: bool = False


class NotificationsToggle(BaseModel):
    enabled: bool


def _agent_configured() -> None:
    if not settings.agent_service_key or not settings.agent_base_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WhatsApp agent is not configured",
        )


async def _call_agent(method: str, path: str, **kwargs) -> httpx.Response:
    _agent_configured()
    url = f"{settings.agent_base_url.rstrip('/')}{path}"
    headers = {"X-Service-Key": settings.agent_service_key}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.request(method, url, headers=headers, **kwargs)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="WhatsApp agent unreachable",
        ) from exc
    if response.status_code >= 400:
        detail = "WhatsApp agent error"
        try:
            detail = response.json().get("detail", detail)
        except ValueError:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)
    return response


@router.post("/link", response_model=LinkCodeResponse)
async def request_link_code(current_user: User = Depends(get_current_user)):
    """Issue a code the user then sends from the phone they want to link."""
    response = await _call_agent("POST", "/internal/links", json={"user_id": str(current_user.id)})
    return response.json()


@router.get("/link", response_model=LinkStatusResponse)
async def link_status(current_user: User = Depends(get_current_user)):
    response = await _call_agent("GET", f"/internal/links/{current_user.id}")
    return response.json()


@router.delete("/link", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_link(current_user: User = Depends(get_current_user)) -> None:
    await _call_agent("DELETE", f"/internal/links/{current_user.id}")


@router.patch("/link/notifications", status_code=status.HTTP_200_OK)
async def set_notifications(
    data: NotificationsToggle, current_user: User = Depends(get_current_user)
):
    response = await _call_agent(
        "PATCH", f"/internal/links/{current_user.id}/notifications", json={"enabled": data.enabled}
    )
    return response.json()
