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
from sqlalchemy.pool import NullPool

from app.core.database import Base, get_db
from app.core.redis_client import redis_pool
from main import app, setup_rate_limiter


# ── Event loop policy ─────────────────────────────────────────
# NOTE: there is deliberately no `event_loop` fixture here.
#
# pytest-asyncio runs each async test in its own function-scoped loop.
# A session-scoped engine therefore hands out asyncpg connections bound
# to the loop that created them, and the next test -- running in a
# different loop -- fails with "Future attached to a different loop".
# Overriding `event_loop` is also deprecated in pytest-asyncio >= 0.23.
#
# Instead: schema setup runs in its own isolated loop and is torn down
# before any test starts, and every test gets a fresh engine with
# NullPool so no connection ever outlives the loop that opened it.
# This mirrors app/tasks/_db.py, which solves the same problem for
# Celery workers.


# ── Test database schema (session, sync) ──────────────────────
@pytest.fixture(scope="session", autouse=True)
def _db_schema():
    """
    Create the schema once per session and drop it at the end.

    This is a *sync* fixture that drives async work through
    asyncio.run(), so it owns a private loop that is closed before any
    test runs. Nothing it opens can leak into a test's loop.
    """
    test_url = os.environ["DATABASE_URL"]

    async def _run(op):
        engine = create_async_engine(test_url, echo=False, poolclass=NullPool)
        try:
            async with engine.begin() as conn:
                await conn.run_sync(op)
        finally:
            await engine.dispose()

    # create_all is idempotent -- it only adds missing tables, so it is
    # safe on a database Alembic already owns (which is what CI does:
    # `alembic upgrade head` then pytest).
    try:
        asyncio.run(_run(Base.metadata.create_all))
    except Exception as e:
        pytest.skip(f"Test database unavailable: {e}")

    yield

    # Deliberately NO drop_all. This fixture used to drop every table at
    # session teardown, which would destroy the schema CI had just
    # migrated and wipe any seeded fixture data. Tests get isolation from
    # the per-test session rollback in `db_session`, not from dropping
    # the database.


# ── Test database engine (per test) ───────────────────────────
@pytest.fixture
async def db_engine():
    """A fresh engine bound to this test's event loop."""
    engine = create_async_engine(
        os.environ["DATABASE_URL"], echo=False, poolclass=NullPool
    )
    yield engine
    await engine.dispose()


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
    """HTTP test client wired to the test database session.

    httpx's ASGITransport does not run the application lifespan, so
    anything main.lifespan() normally sets up has to be started here.
    Without the Redis connect below, every login fails with
    "'NoneType' object has no attribute 'setex'" when the refresh token
    is written -- redis_pool.client is still None.

    Connecting inside this (function-scoped) fixture also keeps the
    Redis client on the same event loop as the test using it.
    """
    await redis_pool.connect()
    try:
        await setup_rate_limiter()
    except Exception:
        pass  # rate limiting is optional in tests; Redis is already up

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
        await redis_pool.disconnect()


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
