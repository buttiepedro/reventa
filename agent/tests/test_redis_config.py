"""A bad REDIS_URL must say what it saw, not just 'invalid DSN scheme'."""

import pytest

from app.core.config import settings
from app.core.redis import redis_settings


@pytest.mark.parametrize("url", ["redis://redis:6379/0", "rediss://default:pw@host:6380/0"])
def test_valid_schemes_are_accepted(monkeypatch, url):
    monkeypatch.setattr(settings, "redis_url", url)
    parsed = redis_settings()
    assert parsed.ssl == url.startswith("rediss")


def test_an_empty_url_is_reported_as_empty(monkeypatch):
    monkeypatch.setattr(settings, "redis_url", "")
    with pytest.raises(RuntimeError, match=r"llegó \(vacío\)"):
        redis_settings()


def test_an_unresolved_railway_placeholder_is_named(monkeypatch):
    monkeypatch.setattr(settings, "redis_url", "${{Redis.REDIS_URL}}")
    with pytest.raises(RuntimeError, match="Redis.REDIS_URL"):
        redis_settings()


def test_credentials_never_reach_the_error_message(monkeypatch):
    monkeypatch.setattr(settings, "redis_url", "http://default:supersecretpassword@host:6379/0")
    with pytest.raises(RuntimeError) as exc:
        redis_settings()
    assert "supersecretpassword" not in str(exc.value)
