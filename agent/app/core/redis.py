"""One place to turn REDIS_URL into arq settings, with an error worth reading."""

from urllib.parse import urlparse

from arq.connections import RedisSettings

from app.core.config import settings

_SCHEMES = {"redis", "rediss", "unix"}


def redis_settings() -> RedisSettings:
    url = settings.redis_url
    scheme = urlparse(url).scheme
    if scheme not in _SCHEMES:
        # Show the shape of what arrived, never the credentials inside it.
        seen = "(vacío)" if not url else f"'{url[:24]}…'" if len(url) > 24 else f"'{url}'"
        raise RuntimeError(
            f"REDIS_URL inválida: se esperaba redis://, rediss:// o unix:// y llegó {seen}. "
            "En Railway, verificá que la variable referencie al servicio de Redis "
            "(por ejemplo ${{Redis.REDIS_URL}}, con el nombre exacto del servicio) y que "
            "no haya quedado el placeholder sin resolver."
        )
    return RedisSettings.from_dsn(url)
