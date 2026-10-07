"""Pytest shared test fixtures for PostgreSQL-backed integration and API tests."""

from collections.abc import AsyncGenerator

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory, engine
from app.main import app


@pytest.fixture(autouse=True)
async def clean_database() -> AsyncGenerator[None, None]:
    """Ensures completely isolated, clean PostgreSQL state for every test."""
    async with async_session_factory() as session:
        await session.execute(
            text(
                "TRUNCATE TABLE locations, services, counters, queue_sessions, "
                "queue_events, service_sessions, wait_observations, estimates CASCADE;"
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
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provides an asynchronous HTTP test client bound to the FastAPI application."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
