"""The webhook is the agent's front door: only Meta gets in, and only once."""

import hashlib
import hmac
import json

from fastapi.testclient import TestClient

import app.main as main
from app.core.config import settings
from app.main import app
from app.services import meta
from tests.conftest import needs_db

client = TestClient(app)  # no lifespan: no migrations, no redis pool

PAYLOAD = {
    "entry": [{"changes": [{"value": {"messages": [
        {"id": "wamid.ABC", "from": "5493410001122", "type": "text", "text": {"body": "hola"}},
        {"id": "wamid.DEF", "from": "5493410001122", "type": "image",
         "image": {"id": "media-1", "caption": "Corolla XEI 2019"}},
    ]}}]}],
}


def _sign(raw: bytes) -> str:
    return "sha256=" + hmac.new(settings.meta_app_secret.encode(), raw, hashlib.sha256).hexdigest()


class TestSignature:
    def test_accepts_a_genuine_signature(self):
        raw = json.dumps(PAYLOAD).encode()
        assert meta.verify_signature(raw, _sign(raw)) is True

    def test_rejects_a_forged_signature(self):
        raw = json.dumps(PAYLOAD).encode()
        assert meta.verify_signature(raw, "sha256=" + "0" * 64) is False

    def test_rejects_a_body_altered_by_one_byte(self):
        raw = json.dumps(PAYLOAD).encode()
        assert meta.verify_signature(raw + b" ", _sign(raw)) is False

    def test_rejects_a_missing_signature(self):
        assert meta.verify_signature(b"{}", None) is False


class TestParsing:
    def test_reads_text_and_image_messages(self):
        parsed = meta.parse_messages(PAYLOAD)
        assert len(parsed) == 2
        assert parsed[0]["phone_e164"] == "+5493410001122"
        assert parsed[0]["body"] == "hola"
        assert parsed[1]["kind"] == "image"
        assert parsed[1]["media_id"] == "media-1"
        assert parsed[1]["caption"] == "Corolla XEI 2019"

    def test_ignores_delivery_status_callbacks(self):
        """Meta sends delivered/read through the same hook; they are not turns."""
        assert meta.parse_messages({"entry": [{"changes": [{"value": {"statuses": [{"id": "x"}]}}]}]}) == []

    def test_ignores_an_empty_payload(self):
        assert meta.parse_messages({}) == []


class TestEndpoints:
    def test_completes_the_subscription_handshake(self):
        response = client.get("/webhook", params={
            "hub.mode": "subscribe",
            "hub.verify_token": settings.meta_verify_token,
            "hub.challenge": "42",
        })
        assert (response.status_code, response.text) == (200, "42")

    def test_refuses_a_handshake_with_the_wrong_token(self):
        response = client.get("/webhook", params={
            "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "42",
        })
        assert response.status_code == 403

    def test_refuses_an_unsigned_delivery(self):
        """Rejection happens before any DB or queue work."""
        assert client.post("/webhook", json={"entry": []}).status_code == 403

    def test_refuses_a_badly_signed_delivery(self):
        response = client.post("/webhook", json={"entry": []},
                               headers={"X-Hub-Signature-256": "sha256=" + "0" * 64})
        assert response.status_code == 403


class TestInternalEndpoints:
    def test_refuses_a_missing_service_key(self):
        response = client.post("/internal/links", json={"user_id": str(__import__("uuid").uuid4())})
        assert response.status_code == 401

    def test_refuses_a_wrong_service_key(self):
        response = client.get("/internal/links/00000000-0000-0000-0000-000000000000",
                              headers={"X-Service-Key": "wrong"})
        assert response.status_code == 401

    @needs_db
    def test_health_reports_ready_when_the_database_answers(self):
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_health_reports_unavailable_when_the_database_is_down(self, monkeypatch):
        """A green health check on a broken database is worse than no health check."""
        def broken():
            raise RuntimeError("connection refused")

        monkeypatch.setattr(main, "AsyncSessionLocal", broken)

        response = client.get("/health")

        assert response.status_code == 503
        assert response.json()["status"] == "unavailable"
