# ============================================================
# OPSYN TEST CONFTEST — tests/conftest.py
# CRITICAL: env vars must be set BEFORE any app module imports.
# This file is loaded by pytest before any test collection.
# ============================================================

import os

# ── Set required env vars immediately ─────────────────────────
# These are set before any import so pydantic-settings can load.
os.environ.setdefault("DATABASE_URL",
    "postgresql+asyncpg://opsyn:opsyn@localhost:5432/opsyn_test")
os.environ.setdefault("SECRET_KEY",
    "test-secret-key-minimum-32-characters-long-for-jwt-signing")
os.environ.setdefault("ENVIRONMENT",       "testing")
os.environ.setdefault("REDIS_URL",         "redis://localhost:6379/0")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/1")
os.environ.setdefault("SMTP_PASSWORD",     "test-smtp-password")
os.environ.setdefault("FRONTEND_URL",      "http://localhost:5173")
os.environ.setdefault("ALLOWED_ORIGINS_STR", "http://localhost:5173")

# ── Now safe to import app modules ────────────────────────────
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    create_async_engine, AsyncSession, async_sessionmaker
)

from app.core.database import Base, get_db
from main import app


# ── Async test configuration ──────────────────────────────────
@pytest.fixture(scope="session")
def event_loop():
    """Provide a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── Test database engine ──────────────────────────────────────
@pytest.fixture(scope="session")
async def db_engine():
    """
    Create test database schema once per session.
    Requires a running PostgreSQL with opsyn_test database.
    Skip gracefully if not available.
    """
    test_url = os.environ["DATABASE_URL"]
    try:
        engine = create_async_engine(test_url, echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()
    except Exception as e:
        pytest.skip(f"Test database unavailable: {e}")


@pytest.fixture
async def db_session(db_engine):
    """Provide a rolled-back async DB session per test."""
    factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session):
    """HTTP test client wired to the test database session."""
    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as c:
        yield c
    app.dependency_overrides.clear()


# ── Auth token fixtures ───────────────────────────────────────
@pytest.fixture
async def admin_token(client):
    """JWT for admin@opsyn.ng — requires seeded DB."""
    resp = await client.post("/api/v1/auth/login", json={
        "email":    "admin@opsyn.ng",
        "password": "opsyn_admin_2026",
    })
    if resp.status_code != 200:
        pytest.skip("Admin user not seeded. Run: make seed")
    return resp.json()["data"]["access_token"]


@pytest.fixture
async def manager_token(client):
    """JWT for a manager-level user — requires seeded DB."""
    resp = await client.post("/api/v1/auth/login", json={
        "email":    "manager@opsyn.ng",
        "password": "opsyn_manager_2026",
    })
    if resp.status_code != 200:
        # Create a mock manager token directly from security module
        from app.core.security import create_access_token
        return create_access_token("00000000-0000-0000-0000-000000000001", {
            "role": "Manager", "role_level": 4, "username": "test.manager"
        })
    return resp.json()["data"]["access_token"]
