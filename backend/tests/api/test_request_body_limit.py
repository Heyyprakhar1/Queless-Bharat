"""Integration tests verifying application-level request body size limits (HTTP 413)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.main import app


@pytest.mark.asyncio
async def test_oversized_content_length_rejected_with_413():
    """Requests declaring Content-Length greater than MAX_REQUEST_BODY_BYTES are
    rejected with 413.
    """
    settings = get_settings()
    max_size = settings.MAX_REQUEST_BODY_BYTES

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request with oversized Content-Length header
        response = await client.post(
            "/api/v1/auth/login",
            content=b"small content",
            headers={
                "Content-Type": "application/json",
                "Content-Length": str(max_size + 1000),
            },
        )
        assert response.status_code == 413
        data = response.json()
        assert "Request body exceeds maximum allowed size" in data["detail"]
        assert str(max_size) in data["detail"]


@pytest.mark.asyncio
async def test_oversized_actual_body_rejected_with_413():
    """Requests sending a payload body greater than MAX_REQUEST_BODY_BYTES are rejected with 413."""
    settings = get_settings()
    max_size = settings.MAX_REQUEST_BODY_BYTES

    # Generate an oversized payload exceeding 1 MB
    oversized_data = b"x" * (max_size + 512)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            content=oversized_data,
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 413
        data = response.json()
        assert "Request body exceeds maximum allowed size" in data["detail"]


@pytest.mark.asyncio
async def test_normal_sized_body_passes_limit_check():
    """Normal-sized requests under the limit pass to standard route processing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Normal login payload (< 1 KB)
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "invalid@test.com", "password": "WrongPassword123!"},
        )
        # Should reach the auth endpoint and return 401 Unauthorized (not 413 Entity Too Large)
        assert response.status_code == 401
