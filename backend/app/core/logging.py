"""Structured logging configuration and secret redaction."""

import logging
import re
import sys
import time
import uuid
from typing import Any

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

SENSITIVE_KEYS = {
    "password",
    "token",
    "secret",
    "authorization",
    "api_key",
    "access_key",
    "refresh_token",
    "cookie",
    "credentials",
}

_SENSITIVE_PATTERNS = [
    # DB URI password: postgresql://user:password@host...
    (
        re.compile(r"(postgres(?:ql)?(?:\+[a-z0-9_]+)?://[^:]+:)([^@]+)(@)", re.IGNORECASE),
        r"\1[REDACTED_DB_PASS]\3",
    ),
    # Bearer tokens and JWTs
    (
        re.compile(
            r"Bearer\s+ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*", re.IGNORECASE
        ),
        "Bearer [REDACTED_JWT]",
    ),
    (
        re.compile(r"ey[A-Za-z0-9-_=]{10,}\.ey[A-Za-z0-9-_=]{10,}\.[A-Za-z0-9-_.+/=]*"),
        "[REDACTED_JWT]",
    ),
    # Sensitive key-value pairs (password=xyz, secret=xyz, token=xyz)
    (
        re.compile(
            r"""(?i)(["']?(?:password|secret|auth_secret|access_token|refresh_token|api_key)["']?\s*[:=]\s*["']?)[^"',\s}]+(["']?)"""
        ),
        r"\1[REDACTED]\2",
    ),
]


def sanitize_sensitive_text(text: str) -> str:
    """Sanitizes passwords, secrets, tokens, and database credentials from freeform error text."""
    if not text:
        return text
    for pattern, replacement in _SENSITIVE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def redact_sensitive_data(
    logger: logging.Logger, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Redacts known sensitive keys and sanitizes sensitive values from log event dictionaries."""
    for key, value in list(event_dict.items()):
        key_lower = key.lower()
        if any(s in key_lower for s in SENSITIVE_KEYS):
            event_dict[key] = "[REDACTED]"
        elif isinstance(value, str):
            event_dict[key] = sanitize_sensitive_text(value)
        elif isinstance(value, dict):
            event_dict[key] = redact_sensitive_data(logger, method_name, value)
    return event_dict


def setup_logging() -> None:
    """Configures structured logging for application and external libraries."""
    settings = get_settings()

    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        redact_sensitive_data,
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.ENVIRONMENT == "development":
        # Formatted console output for local development
        renderer = structlog.dev.ConsoleRenderer(colors=True)
    else:
        # Structured JSON records for staging and production (CloudWatch)
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.UnicodeDecoder(),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(log_level)

    # Silence overly verbose external loggers
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("uvicorn.access").propagate = False


def get_logger(name: str = "queless") -> structlog.stdlib.BoundLogger:
    """Returns a bound structured logger."""
    return structlog.get_logger(name)


class LoggingMiddleware(BaseHTTPMiddleware):
    """HTTP middleware capturing structured logs per request lifecycle."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        start_time = time.perf_counter()

        logger = get_logger("http_access")
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response: Response
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                "request_failed",
                path=request.url.path,
                method=request.method,
                status=500,
                duration_ms=duration_ms,
                error=str(exc),
            )
            raise
        else:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(
                "request_completed",
                path=request.url.path,
                method=request.method,
                status=status_code,
                duration_ms=duration_ms,
            )
            response.headers["X-Request-ID"] = request_id
            return response
