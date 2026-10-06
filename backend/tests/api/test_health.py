"""Tests for health and readiness check endpoints."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.schemas.health import HealthResponse


@pytest.mark.asyncio
async def test_health_check_healthy(client: httpx.AsyncClient) -> None:
    """Verifies that health check returns 200 OK when the database is healthy."""
    with patch(
        "app.api.v1.endpoints.health.check_db_connectivity",
        new_callable=AsyncMock,
    ) as mock_db:
        mock_db.return_value = True

        response = await client.get("/api/v1/health")
        assert response.status_code == 200

        data = response.json()
        validated = HealthResponse(**data)
        assert validated.status == "ok"
        assert validated.database == "connected"
        assert validated.environment in {"development", "staging", "production"}


@pytest.mark.asyncio
async def test_health_check_degraded(client: httpx.AsyncClient) -> None:
    """Verifies that health check returns 503 when the database is disconnected."""
    with patch(
        "app.api.v1.endpoints.health.check_db_connectivity",
        new_callable=AsyncMock,
    ) as mock_db:
        mock_db.return_value = False

        response = await client.get("/api/v1/health")
        assert response.status_code == 503

        data = response.json()
        validated = HealthResponse(**data)
        assert validated.status == "degraded"
        assert validated.database == "disconnected"


@pytest.mark.asyncio
async def test_root_health_route(client: httpx.AsyncClient) -> None:
    """Verifies that top-level /health route behaves identically for load balancer probes."""
    with patch(
        "app.api.v1.endpoints.health.check_db_connectivity",
        new_callable=AsyncMock,
    ) as mock_db:
        mock_db.return_value = True

        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_root_info_route(client: httpx.AsyncClient) -> None:
    """Verifies that top-level / route returns metadata."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert "docs_url" in data
