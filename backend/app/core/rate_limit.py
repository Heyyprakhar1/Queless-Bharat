"""In-memory sliding window rate limiter for abuse control and DoS deterrence."""

import asyncio
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from app.core.config import get_settings


class SlidingWindowRateLimiter:
    """Thread-safe and coroutine-safe in-memory rate limiter using sliding timestamp window."""

    def __init__(self, max_requests: int, window_seconds: int, scope: str = "default") -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope
        self.records: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    def _get_client_key(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif request.client and request.client.host:
            client_ip = request.client.host
        else:
            client_ip = "unknown_client"
        return f"{self.scope}:{client_ip}"

    async def __call__(self, request: Request) -> None:
        import os

        settings = get_settings()
        if (
            not settings.RATE_LIMIT_ENABLED
            or settings.ENVIRONMENT == "test"
            or "PYTEST_CURRENT_TEST" in os.environ
        ):
            return

        client_key = self._get_client_key(request)
        max_requests = self.max_requests
        window_seconds = self.window_seconds

        if self.scope == "auth_login":
            max_requests = settings.RATE_LIMIT_LOGIN_MAX
            window_seconds = settings.RATE_LIMIT_LOGIN_WINDOW
        elif self.scope == "auth_register":
            max_requests = settings.RATE_LIMIT_REGISTER_MAX
            window_seconds = settings.RATE_LIMIT_REGISTER_WINDOW
        elif self.scope == "queue_checkin":
            max_requests = settings.RATE_LIMIT_CHECKIN_MAX
            window_seconds = settings.RATE_LIMIT_CHECKIN_WINDOW

        now = time.monotonic()
        cutoff = now - window_seconds

        async with self._lock:
            # Purge timestamps older than the sliding window
            timestamps = [t for t in self.records[client_key] if t > cutoff]
            if len(timestamps) >= max_requests:
                earliest = timestamps[0]
                retry_after = max(1, int(window_seconds - (now - earliest)))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded for {self.scope}. Please retry in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)},
                )
            timestamps.append(now)
            self.records[client_key] = timestamps


# Preconfigured rate limiter dependencies
rate_limit_auth_login = SlidingWindowRateLimiter(
    max_requests=20, window_seconds=60, scope="auth_login"
)
rate_limit_auth_register = SlidingWindowRateLimiter(
    max_requests=10, window_seconds=60, scope="auth_register"
)
rate_limit_queue_checkin = SlidingWindowRateLimiter(
    max_requests=30, window_seconds=60, scope="queue_checkin"
)
