"""WhatsApp Cloud API client and webhook parsing."""

import hashlib
import hmac
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 15.0
# Anything else (audio, video, documents, stickers) is acknowledged and declined.
SUPPORTED_KINDS = {"text", "image"}


def verify_signature(raw_body: bytes, header: str | None) -> bool:
    """Check Meta's HMAC of the raw body.

    Must run against the exact bytes received — re-serializing the JSON changes the
    digest and every legitimate message would be rejected.
    """
    if not settings.meta_app_secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(
        settings.meta_app_secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header.removeprefix("sha256="))


def _to_e164(raw: str) -> str:
    digits = "".join(c for c in raw if c.isdigit())
    return f"+{digits}"


def parse_messages(payload: dict) -> list[dict]:
    """Flatten a webhook payload into the messages we care about.

    Meta batches entries and changes, and also delivers status callbacks (delivered,
    read) through the same hook — those carry no `messages` key and are skipped.
    """
    parsed: list[dict] = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for message in value.get("messages", []):
                kind = message.get("type", "unknown")
                parsed.append(
                    {
                        "meta_message_id": message.get("id", ""),
                        "phone_e164": _to_e164(message.get("from", "")),
                        "kind": kind,
                        "body": message.get("text", {}).get("body") if kind == "text" else None,
                        "media_id": message.get(kind, {}).get("id") if kind == "image" else None,
                        "caption": message.get(kind, {}).get("caption") if kind == "image" else None,
                    }
                )
    return parsed


class MetaClient:
    def __init__(self) -> None:
        self._base = f"https://graph.facebook.com/{settings.meta_api_version}"
        self._headers = {"Authorization": f"Bearer {settings.meta_access_token}"}

    async def get_media(self, media_id: str) -> tuple[bytes, str]:
        """Download one media item. Two hops: metadata, then the signed CDN URL.

        The URL is short-lived, so it is fetched at the moment it is needed rather
        than stored. `media_id` itself stays valid for weeks, which is what lets a
        draft be confirmed minutes after the photos arrived.
        """
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            meta_response = await client.get(f"{self._base}/{media_id}", headers=self._headers)
            meta_response.raise_for_status()
            info = meta_response.json()
            binary = await client.get(info["url"], headers=self._headers)
            binary.raise_for_status()
        return binary.content, info.get("mime_type", "image/jpeg")

    async def send_template(self, to_e164: str, name: str, language: str, params: list[str]) -> tuple[bool, str]:
        """Send a pre-approved template — the only thing Meta accepts outside the 24h window."""
        if not settings.meta_access_token or not settings.meta_phone_number_id:
            return False, "Meta credentials missing"
        payload = {
            "messaging_product": "whatsapp",
            "to": to_e164.lstrip("+"),
            "type": "template",
            "template": {
                "name": name,
                "language": {"code": language},
                "components": [
                    {
                        "type": "body",
                        "parameters": [{"type": "text", "text": value} for value in params],
                    }
                ]
                if params
                else [],
            },
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f"{self._base}/{settings.meta_phone_number_id}/messages",
                headers=self._headers,
                json=payload,
            )
        if response.status_code >= 400:
            logger.error("Meta template send failed (%s): %s", response.status_code, response.text)
            return False, response.text[:500]
        return True, ""

    async def send_text(self, to_e164: str, body: str) -> None:
        """Reply inside the 24h window. Outside it Meta rejects free-form text."""
        if not settings.meta_access_token or not settings.meta_phone_number_id:
            logger.warning("Meta credentials missing — dropping reply to %s", to_e164)
            return
        url = f"{self._base}/{settings.meta_phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_e164.lstrip("+"),
            "type": "text",
            "text": {"preview_url": True, "body": body[:4096]},
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(url, headers=self._headers, json=payload)
        if response.status_code >= 400:
            logger.error("Meta send failed (%s): %s", response.status_code, response.text)
