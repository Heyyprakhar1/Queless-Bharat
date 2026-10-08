"""Unit tests for in-memory rate limiting and sliding window abuse protection."""

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.rate_limit import SlidingWindowRateLimiter


def make_mock_request(client_ip: str = "192.168.1.100") -> Request:
    """Creates a mock Starlette request object."""
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "headers": [],
        "client": (client_ip, 12345),
    }
    return Request(scope)


class TestRateLimiter:
    """Verifies sliding window rate limiting semantics."""

    async def test_requests_within_limit_pass(self, monkeypatch):
        """Requests under max_requests execute without raising 429."""
        monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
        limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=10, scope="test_pass")
        req = make_mock_request()

        # 3 requests should all pass
        await limiter(req)
        await limiter(req)
        await limiter(req)
        assert len(limiter.records[limiter._get_client_key(req)]) == 3

    async def test_requests_exceeding_limit_raise_429(self, monkeypatch):
        """Requests exceeding max_requests within window raise HTTP 429."""
        monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
        limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=60, scope="test_block")
        req = make_mock_request()

        await limiter(req)
        await limiter(req)

        with pytest.raises(HTTPException) as exc_info:
            await limiter(req)

        assert exc_info.value.status_code == 429
        assert "Rate limit exceeded" in exc_info.value.detail
        assert "Retry-After" in exc_info.value.headers

    async def test_different_clients_tracked_independently(self, monkeypatch):
        """Client A reaching limit does not block Client B."""
        monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
        limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=60, scope="test_isolated")
        req_a = make_mock_request("10.0.0.1")
        req_b = make_mock_request("10.0.0.2")

        await limiter(req_a)
        with pytest.raises(HTTPException):
            await limiter(req_a)

        # Client B is not blocked
        await limiter(req_b)
