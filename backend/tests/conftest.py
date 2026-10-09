"""Pytest shared test fixtures for PostgreSQL-backed integration and API tests."""

import uuid
from collections.abc import AsyncGenerator

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.db.session import async_session_factory, engine
from app.domain.enums import UserRole
from app.domain.models import User
from app.main import app


@pytest.fixture(autouse=True)
async def clean_database() -> AsyncGenerator[None, None]:
    """Ensures completely isolated, clean PostgreSQL state for every test."""
    async with async_session_factory() as session:
        await session.execute(
            text(
                "TRUNCATE TABLE users, user_identities, locations, services, "
                "counters, queue_sessions, queue_events, service_sessions, "
                "wait_observations, estimates CASCADE;"
            )
        )
        await session.commit()
    yield
    await engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields a managed database session for direct repository/service testing."""
    async with async_session_factory() as session:
        yield session


@pytest.fixture
async def make_user():
    """Factory fixture to create test users with genuine hashed passwords and JWT tokens."""

    async def _make_user(
        email: str,
        role: UserRole = UserRole.CITIZEN,
        full_name: str = "Test User",
        assigned_service_id: uuid.UUID | None = None,
        is_active: bool = True,
        password: str = "testpassword123",
    ) -> tuple[User, str, dict[str, str]]:
        async with async_session_factory() as session:
            user = User(
                email=email.lower(),
                full_name=full_name,
                hashed_password=get_password_hash(password),
                role=role,
                assigned_service_id=assigned_service_id,
                is_active=is_active,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

            token = create_access_token(
                subject=str(user.id),
                role=user.role,
                extra_claims={"email": user.email, "name": user.full_name},
            )
            headers = {"Authorization": f"Bearer {token}"}
            return user, token, headers

    return _make_user


@pytest.fixture
async def admin_auth(make_user) -> tuple[User, str, dict[str, str]]:
    """Yields default admin user, token, and headers."""
    return await make_user("admin@queless.gov.in", role=UserRole.ADMIN, full_name="Admin Director")


@pytest.fixture
async def operator_auth(make_user) -> tuple[User, str, dict[str, str]]:
    """Yields default operator user, token, and headers."""
    return await make_user(
        "operator@queless.gov.in", role=UserRole.OPERATOR, full_name="Desk Operator 1"
    )


@pytest.fixture
async def citizen_auth(make_user) -> tuple[User, str, dict[str, str]]:
    """Yields default citizen user, token, and headers."""
    return await make_user(
        "citizen@queless.gov.in", role=UserRole.CITIZEN, full_name="Citizen Rahul"
    )


@pytest.fixture
async def unauth_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provides an unauthenticated asynchronous HTTP test client."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client(admin_auth) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provides a default authenticated HTTP test client (Admin role) for domain regressions."""
    _, _, headers = admin_auth
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", headers=headers
    ) as ac:
        yield ac
