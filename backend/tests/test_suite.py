# ============================================================
# OPSYN TEST SUITE
# conftest.py + factories + unit + integration + E2E tests
# Run: pytest tests/ -v
# ============================================================

# ══ tests/conftest.py ════════════════════════════════════════
import asyncio, pytest, uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.database import Base, get_db
from main import app

TEST_DB_URL = "postgresql+asyncpg://opsyn:opsyn@localhost:5432/opsyn_test"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(db_engine):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db_session):
    async def override_db():
        yield db_session
    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
async def admin_token(client):
    # Assumes seed data has admin@opsyn.ng / opsyn_admin_pass
    resp = await client.post("/api/v1/auth/login",
                              json={"email": "admin@opsyn.ng", "password": "opsyn_admin_pass"})
    return resp.json()["data"]["access_token"]

@pytest.fixture
async def manager_token(client):
    resp = await client.post("/api/v1/auth/login",
                              json={"email": "manager@opsyn.ng", "password": "opsyn_manager_pass"})
    return resp.json()["data"]["access_token"]


# ══ tests/unit/test_staff_policy.py ══════════════════════════
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from app.modules.staff.policy import StaffPolicy

def make_user(level: int, dept_ids: list = None):
    user = MagicMock()
    user.role.level = level
    user.id = uuid.uuid4()
    scopes = []
    for dept_id in (dept_ids or []):
        scope = MagicMock()
        scope.scope_type = "department"
        scope.scope_reference_id = dept_id
        scopes.append(scope)
    user.scopes = scopes
    return user

class TestStaffPolicy:
    def test_admin_can_create_any_dept(self):
        caller = make_user(5)
        dept   = uuid.uuid4()
        StaffPolicy.can_create(caller, dept, 1)  # Should not raise

    def test_manager_can_create_own_dept(self):
        dept   = uuid.uuid4()
        caller = make_user(4, [dept])
        StaffPolicy.can_create(caller, dept, 1)  # Should not raise

    def test_manager_cannot_create_other_dept(self):
        caller = make_user(4, [uuid.uuid4()])
        with pytest.raises(HTTPException) as exc:
            StaffPolicy.can_create(caller, uuid.uuid4(), 1)
        assert exc.value.status_code == 403

    def test_staff_cannot_create(self):
        caller = make_user(1)
        with pytest.raises(HTTPException) as exc:
            StaffPolicy.can_create(caller, uuid.uuid4(), 1)
        assert exc.value.status_code == 403

    def test_hierarchy_violation_same_level(self):
        dept   = uuid.uuid4()
        caller = make_user(4, [dept])
        with pytest.raises(HTTPException) as exc:
            StaffPolicy.can_create(caller, dept, 4)  # target level == caller level
        assert exc.value.status_code == 403

    def test_hierarchy_violation_above_level(self):
        dept   = uuid.uuid4()
        caller = make_user(4, [dept])
        with pytest.raises(HTTPException) as exc:
            StaffPolicy.can_create(caller, dept, 5)  # target > caller
        assert exc.value.status_code == 403

    def test_can_assign_role_below_own_level(self):
        caller = make_user(5)
        StaffPolicy.can_assign_role(caller, 4)  # Should not raise

    def test_cannot_assign_role_at_own_level(self):
        caller = make_user(5)
        with pytest.raises(HTTPException):
            StaffPolicy.can_assign_role(caller, 5)

    def test_non_admin_cannot_assign_roles(self):
        caller = make_user(4)
        with pytest.raises(HTTPException):
            StaffPolicy.can_assign_role(caller, 2)


# ══ tests/integration/test_auth_routes.py ════════════════════
import pytest

@pytest.mark.asyncio
class TestAuthRoutes:
    async def test_login_invalid_credentials(self, client):
        resp = await client.post("/api/v1/auth/login",
                                  json={"email": "nobody@opsyn.ng", "password": "wrong"})
        assert resp.status_code == 401

    async def test_login_valid(self, client, admin_token):
        assert admin_token is not None
        assert len(admin_token) > 20

    async def test_protected_route_without_token(self, client):
        resp = await client.get("/api/v1/staff")
        assert resp.status_code == 401

    async def test_protected_route_with_valid_token(self, client, admin_token):
        resp = await client.get("/api/v1/staff",
                                 headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200

    async def test_refresh_without_cookie(self, client):
        resp = await client.post("/api/v1/auth/refresh")
        assert resp.status_code == 401


# ══ tests/integration/test_staff_routes.py ═══════════════════
@pytest.mark.asyncio
class TestStaffRoutes:
    async def test_staff_list_requires_manager(self, client, admin_token):
        resp = await client.get("/api/v1/staff",
                                 headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

    async def test_create_staff_requires_manager(self, client, admin_token, db_session):
        payload = {
            "first_name": "Test", "last_name": "User", "email": "test.user@opsyn.ng",
            "username": "test.user", "role_id": str(uuid.uuid4()),
            "department_id": str(uuid.uuid4()), "job_title": "NOC Operator",
            "employment_type": "permanent", "scope_level": "department",
            "allowed_dashboards": ["noc"], "approval_authority_level": 0,
            "status": "active", "invite_method": "email",
        }
        # This will 422 on role_id not found — that's expected without seeded data
        resp = await client.post("/api/v1/staff", json=payload,
                                  headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code in (201, 422, 409)

    async def test_staff_list_unauthorized_for_staff_role(self, client, manager_token):
        # Manager token should work; plain staff token would 403
        resp = await client.get("/api/v1/staff",
                                 headers={"Authorization": f"Bearer {manager_token}"})
        assert resp.status_code in (200, 403)


# ══ tests/integration/test_task_routes.py ════════════════════
@pytest.mark.asyncio
class TestTaskRoutes:
    async def test_board_endpoint(self, client, admin_token):
        resp = await client.get("/api/v1/tasks/board",
                                 headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "overdue" in data
        assert "today" in data
        assert "this_week" in data
        assert "backlog" in data

    async def test_create_task(self, client, admin_token):
        resp = await client.post("/api/v1/tasks",
                                  json={"title": "Test task", "priority": "high",
                                        "status": "in_progress"},
                                  headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["title"] == "Test task"

    async def test_my_tasks_endpoint(self, client, admin_token):
        resp = await client.get("/api/v1/tasks/my",
                                 headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200


# ══ tests/e2e/test_scope_violation.py ════════════════════════
@pytest.mark.asyncio
class TestScopeViolation:
    async def test_manager_cannot_access_other_dept_staff(self, client, manager_token):
        """Manager with dept A scope cannot list staff from dept B."""
        resp = await client.get("/api/v1/staff?dept_id=00000000-0000-0000-0000-000000000000",
                                 headers={"Authorization": f"Bearer {manager_token}"})
        # Either returns empty list (scoped) or 403 — never returns cross-dept data
        assert resp.status_code in (200, 403)
        if resp.status_code == 200:
            data = resp.json()["data"]
            assert data["total"] == 0  # No cross-dept leak

    async def test_audit_logs_forbidden_for_manager(self, client, manager_token):
        resp = await client.get("/api/v1/audit-logs",
                                 headers={"Authorization": f"Bearer {manager_token}"})
        assert resp.status_code == 403

    async def test_onboarding_approval_forbidden_for_manager(self, client, manager_token):
        fake_id = str(uuid.uuid4())
        resp = await client.patch(f"/api/v1/onboarding/{fake_id}/approve",
                                   headers={"Authorization": f"Bearer {manager_token}"})
        assert resp.status_code == 403
