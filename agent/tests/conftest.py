"""Test fixtures.

The DB-backed tests need a real Postgres: the schema uses JSONB and a partial
unique index, so SQLite would test a different thing than what runs in production.
Point AGENT_TEST_DATABASE_URL at a throwaway database; without it they skip.
"""

import os
import random
import uuid

import pytest

TEST_DB = os.getenv("AGENT_TEST_DATABASE_URL")

# Config is read at import time, so this must be set before app modules load.
os.environ.setdefault("AGENT_SERVICE_KEY", "test-service-key")
os.environ.setdefault("META_APP_SECRET", "test-app-secret")
os.environ.setdefault("META_VERIFY_TOKEN", "test-verify-token")
if TEST_DB:
    os.environ["DATABASE_URL"] = TEST_DB

needs_db = pytest.mark.skipif(
    not TEST_DB, reason="set AGENT_TEST_DATABASE_URL to run DB-backed tests"
)


@pytest.fixture
def phone() -> str:
    """A fresh number per test — links are unique per number by design."""
    return f"+549341{random.randrange(10**7):07d}"


@pytest.fixture
def user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture(autouse=True)
def _fresh_pool():
    """Never let a connection pool outlive the event loop that filled it.

    pytest-asyncio gives each test its own loop, and TestClient runs its own on top
    of that; asyncpg connections are bound to the loop that opened them, so the
    engine is disposed after every test regardless of which kind it was.
    """
    yield
    if not TEST_DB:
        return
    import asyncio

    from app.core.database import engine

    try:
        asyncio.run(engine.dispose())
    except RuntimeError:  # no loop to close — nothing was opened
        pass


@pytest.fixture
async def session():
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        yield s
