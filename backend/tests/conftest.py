"""Fixtures para los tests de permisos.

Necesitan un Postgres real: el esquema usa enums de Postgres y UUID nativos, así
que SQLite probaría otra cosa. Sin BACKEND_TEST_DATABASE_URL se saltean.
"""

import os
import uuid

import pytest

TEST_DB = os.getenv("BACKEND_TEST_DATABASE_URL")

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long")
os.environ.setdefault("ADMIN_EMAIL", "super@test.com")
os.environ.setdefault("ADMIN_PASSWORD", "super123")
if TEST_DB:
    os.environ["DATABASE_URL"] = TEST_DB

needs_db = pytest.mark.skipif(
    not TEST_DB, reason="set BACKEND_TEST_DATABASE_URL to run DB-backed tests"
)


@pytest.fixture(autouse=True)
def _fresh_pool():
    """El pool no sobrevive al event loop del test que lo abrió."""
    yield
    if not TEST_DB:
        return
    import asyncio

    from app.core.database import engine

    try:
        asyncio.run(engine.dispose())
    except RuntimeError:
        pass


@pytest.fixture
async def client():
    from httpx import ASGITransport, AsyncClient

    from app.core.seed import seed_super_admin
    from app.main import app

    await seed_super_admin()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t/api/v1") as c:
        yield c


async def login(client, email: str, password: str) -> dict:
    r = await client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
async def super_admin(client):
    return await login(client, "super@test.com", "super123")


@pytest.fixture
async def world(client, super_admin):
    """Dos agencias, cada una con su admin, y un usuario suelto en la segunda."""
    tag = uuid.uuid4().hex[:8]
    out = {"tag": tag}
    for key in ("a", "b"):
        company = (await client.post(
            "/companies", json={"name": f"Agencia {key}{tag}", "slug": f"{key}{tag}"}, headers=super_admin
        )).json()
        admin = (await client.post(
            f"/companies/{company['id']}/users", headers=super_admin,
            json={"email": f"admin.{key}{tag}@t.com", "password": "pass1234",
                  "full_name": f"Admin {key}", "role": "company_admin"},
        )).json()
        out[key] = {"company": company, "admin": admin,
                    "headers": await login(client, f"admin.{key}{tag}@t.com", "pass1234")}
    out["b"]["user"] = (await client.post(
        f"/companies/{out['b']['company']['id']}/users", headers=super_admin,
        json={"email": f"user.b{tag}@t.com", "password": "pass1234",
              "full_name": "User B", "role": "company_user"},
    )).json()
    out["super_id"] = (await client.get("/auth/me", headers=super_admin)).json()["id"]
    return out
