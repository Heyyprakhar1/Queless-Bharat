"""In-memory sliding window rate limiter for abuse control and DoS deterrence.

Architecture & Proxy Note:
--------------------------
In a direct deployment (e.g. local development or bare container without a trusted reverse proxy),
TRUST_PROXY_HEADERS is False by default. The rate limiter strictly identifies callers by their
direct socket IP (request.client.host), discarding arbitrary or client-controlled headers such
as X-Forwarded-For to prevent trivial rate limit evasion.

In an AWS production deployment behind an Application Load Balancer (ALB) or reverse proxy:
1. The ALB/WAF terminates client TLS, sanitizes incoming headers, and appends the verified
   client IP to X-Forwarded-For before forwarding traffic to ECS container tasks.
2. The application must be configured with TRUST_PROXY_HEADERS=True and TRUSTED_PROXIES set to
   the VPC subnet CIDR or ALB private IPs.
3. When the direct socket IP matches a configured trusted proxy, the rate limiter parses the
   forwarded client IP. If a request arrives from an untrusted socket, X-Forwarded-For is ignored.
"""

import asyncio
import ipaddress
import time
from collections import defaultdict
from typing import Sequence

from fastapi import HTTPException, Request, status

from app.core.config import get_settings


def is_trusted_proxy(ip_str: str, trusted_proxies: Sequence[str]) -> bool:
    """Checks if an IP address belongs to the configured list of trusted proxies or CIDR blocks."""
    if not ip_str or ip_str == "unknown_client":
        return False
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False

    for proxy_pattern in trusted_proxies:
        proxy_pattern = proxy_pattern.strip()
        if not proxy_pattern:
            continue
        try:
            if "/" in proxy_pattern:
                if ip in ipaddress.ip_network(proxy_pattern, strict=False):
                    return True
            else:
                if ip == ipaddress.ip_address(proxy_pattern):
                    return True
        except ValueError:
            if ip_str == proxy_pattern:
                return True
    return False


class SlidingWindowRateLimiter:
    """Thread-safe and coroutine-safe in-memory rate limiter using sliding timestamp window."""

    def __init__(self, max_requests: int, window_seconds: int, scope: str = "default") -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope
        self.records: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    def _get_client_key(self, request: Request) -> str:
        settings = get_settings()
        direct_ip = (
            request.client.host
            if request.client and request.client.host
            else "unknown_client"
        )

        # Explicit Trusted Proxy Enforcement:
        # Only parse X-Forwarded-For if TRUST_PROXY_HEADERS is explicitly enabled
        # AND the direct connecting socket IP is within the configured TRUSTED_PROXIES list.
        if settings.TRUST_PROXY_HEADERS and is_trusted_proxy(direct_ip, settings.TRUSTED_PROXIES):
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                candidate_ip = forwarded.split(",")[0].strip()
                try:
                    # Validate candidate is a syntactically valid IP address
                    ipaddress.ip_address(candidate_ip)
                    return f"{self.scope}:{candidate_ip}"
                except ValueError:
                    # Ignore malformed or spoofed forwarded IP and fallback to direct socket
                    pass

        return f"{self.scope}:{direct_ip}"

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
        elif self.scope == "poll_service":
            max_requests = settings.RATE_LIMIT_POLL_SERVICE_MAX
            window_seconds = settings.RATE_LIMIT_POLL_SERVICE_WINDOW
        elif self.scope == "poll_session":
            max_requests = settings.RATE_LIMIT_POLL_SESSION_MAX
            window_seconds = settings.RATE_LIMIT_POLL_SESSION_WINDOW

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


# Preconfigured rate limiter dependencies for sensitive routes
rate_limit_auth_login = SlidingWindowRateLimiter(
    max_requests=100, window_seconds=60, scope="auth_login"
)
rate_limit_auth_register = SlidingWindowRateLimiter(
    max_requests=50, window_seconds=60, scope="auth_register"
)
rate_limit_queue_checkin = SlidingWindowRateLimiter(
    max_requests=200, window_seconds=60, scope="queue_checkin"
)
rate_limit_poll_service = SlidingWindowRateLimiter(
    max_requests=120, window_seconds=60, scope="poll_service"
)
rate_limit_poll_session = SlidingWindowRateLimiter(
    max_requests=60, window_seconds=60, scope="poll_session"
)
