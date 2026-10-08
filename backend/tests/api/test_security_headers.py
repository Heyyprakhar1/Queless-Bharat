"""Tests verifying HTTP security defense headers, CSP, and conditional HSTS behavior."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.main import app


@pytest.mark.asyncio
async def test_standard_security_headers_present():
    """All responses must include standard defense-in-depth security headers."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200

        # Mandatory defense headers
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert response.headers.get("X-XSS-Protection") == "0"

        # Content-Security-Policy verification
        csp = response.headers.get("Content-Security-Policy")
        assert csp is not None
        assert "default-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp
        assert "object-src 'none'" in csp
        assert "base-uri 'self'" in csp


@pytest.mark.asyncio
async def test_hsts_absent_in_development_http(monkeypatch):
    """HSTS must NOT be emitted over plain HTTP or in development environment."""
    settings = get_settings()
    monkeypatch.setattr(settings, "ENABLE_HSTS", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert "Strict-Transport-Security" not in response.headers


@pytest.mark.asyncio
async def test_hsts_emitted_when_explicitly_enabled(monkeypatch):
    """HSTS is emitted when ENABLE_HSTS is explicitly configured True."""
    settings = get_settings()
    monkeypatch.setattr(settings, "ENABLE_HSTS", True)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        hsts = response.headers.get("Strict-Transport-Security")
        assert hsts is not None
        assert "max-age=31536000" in hsts
        assert "includeSubDomains" in hsts


@pytest.mark.asyncio
async def test_hsts_emitted_in_production_https(monkeypatch):
    """HSTS is emitted when environment is production and request is over HTTPS."""
    settings = get_settings()
    monkeypatch.setattr(settings, "ENABLE_HSTS", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://test") as client:
        response = await client.get("/health")
        hsts = response.headers.get("Strict-Transport-Security")
        assert hsts is not None
        assert "max-age=31536000" in hsts
