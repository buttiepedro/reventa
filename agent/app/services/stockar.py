"""Client for the Stockar API — the agent's only door to product data."""

import logging
import uuid

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 20.0


class StockarError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class StockarClient:
    """Acts as one user for the length of one conversation turn.

    The token is minted per turn and lives five minutes; the tenant comes from it,
    so no call here ever passes a company_id of its own choosing.
    """

    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        self._base = settings.stockar_api_url.rstrip("/")
        self._token: str | None = None

    async def _ensure_token(self, client: httpx.AsyncClient) -> str:
        if self._token:
            return self._token
        response = await client.post(
            f"{self._base}/auth/service-token",
            headers={"X-Service-Key": settings.agent_service_key},
            json={"user_id": str(self.user_id)},
        )
        if response.status_code >= 400:
            raise StockarError(response.status_code, "No pude autenticarte contra Stockar")
        self._token = response.json()["access_token"]
        return self._token

    async def request(self, method: str, path: str, **kwargs) -> tuple[int, object]:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            token = await self._ensure_token(client)
            response = await client.request(
                method,
                f"{self._base}{path}",
                headers={"Authorization": f"Bearer {token}"},
                **kwargs,
            )
        if response.status_code == 204:
            return response.status_code, None
        try:
            return response.status_code, response.json()
        except ValueError:
            return response.status_code, response.text

    async def get(self, path: str, params: dict | None = None) -> tuple[int, object]:
        clean = {k: v for k, v in (params or {}).items() if v is not None}
        return await self.request("GET", path, params=clean)

    async def post(self, path: str, json: dict | None = None) -> tuple[int, object]:
        return await self.request("POST", path, json=json or {})

    async def post_file(
        self, path: str, content: bytes, filename: str, content_type: str, params: dict | None = None
    ) -> tuple[int, object]:
        return await self.request(
            "POST",
            path,
            files={"file": (filename, content, content_type)},
            params={k: v for k, v in (params or {}).items() if v is not None},
        )

    async def me(self) -> dict:
        status_code, body = await self.get("/auth/me")
        if status_code >= 400 or not isinstance(body, dict):
            raise StockarError(status_code, "No pude leer tu perfil")
        return body
