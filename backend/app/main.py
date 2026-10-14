"""QueuelessBharat backend application entrypoint."""

import json
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.router import api_router
from app.api.v1.endpoints.health import check_health
from app.core.config import get_settings
from app.core.logging import (
    LoggingMiddleware,
    get_logger,
    sanitize_sensitive_text,
    setup_logging,
)
from app.domain.exceptions import (
    DomainError,
    DuplicateIdempotencyKeyError,
    EstimationUnavailableError,
    InvalidStateTransitionError,
    ResourceNotFoundError,
)

settings = get_settings()
logger = get_logger("app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager initializing runtime services."""
    setup_logging()
    logger.info(
        "application_startup",
        environment=settings.ENVIRONMENT,
        project_name=settings.PROJECT_NAME,
        allowed_origins=settings.ALLOWED_ORIGINS,
    )
    yield
    logger.info("application_shutdown")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Queue intelligence platform for predictable waiting across public service touchpoints."
    ),
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)


class RequestBodyLimitMiddleware:
    """Enforces an application-level maximum request body size (HTTP 413).

    Protects application memory and resources against oversized payloads (default 1 MB).
    Performs fast-path rejection via Content-Length header, and monitors streaming/chunked bodies.
    Note: Edge/ALB/WAF limits should additionally be configured in production infrastructure.
    """

    def __init__(self, app: Any, max_body_size: int | None = None) -> None:
        self.app = app
        self.max_body_size = max_body_size

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        settings = get_settings()
        max_size = (
            self.max_body_size
            if self.max_body_size is not None
            else settings.MAX_REQUEST_BODY_BYTES
        )

        # 1. Fast-path check via Content-Length header
        for name, value in scope.get("headers", []):
            if name.lower() == b"content-length":
                try:
                    content_length = int(value.decode("latin1"))
                    if content_length > max_size:
                        await self._send_413(send, max_size)
                        return
                except ValueError:
                    pass
                break

        # 2. Streaming check for chunked / unannounced request bodies
        bytes_received = 0
        limit_exceeded = False

        async def receive_with_limit() -> Any:
            nonlocal bytes_received, limit_exceeded
            message = await receive()
            if message.get("type") == "http.request":
                body = message.get("body", b"")
                bytes_received += len(body)
                if bytes_received > max_size:
                    limit_exceeded = True
            return message

        async def send_wrapper(message: Any) -> None:
            if limit_exceeded:
                return
            await send(message)

        if limit_exceeded:
            await self._send_413(send, max_size)
            return

        try:
            await self.app(scope, receive_with_limit, send_wrapper)
            if limit_exceeded:
                await self._send_413(send, max_size)
        except Exception:
            if limit_exceeded:
                await self._send_413(send, max_size)
            else:
                raise

    async def _send_413(self, send: Any, max_size: int) -> None:
        body = json.dumps(
            {"detail": f"Request body exceeds maximum allowed size of {max_size} bytes"}
        ).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("latin1")),
                ],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": body,
            }
        )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces standard HTTP security defense headers on all outgoing responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        settings = get_settings()

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content-Security-Policy: restrict origins, allow Swagger UI &
        # React/Vite development/production
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "font-src 'self' data:; "
            "connect-src 'self' http: https: ws: wss:; "
            "frame-ancestors 'none'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )

        # X-XSS-Protection rationale: Modern browsers have deprecated the legacy XSS auditor
        # in favor of Content-Security-Policy (CSP). Setting it to 0 explicitly disables the
        # legacy auditor to avoid auditor-based vulnerability exploitation, as recommended by OWASP.
        response.headers["X-XSS-Protection"] = "0"

        # HSTS: Strict-Transport-Security ONLY when explicitly enabled or in production with HTTPS
        if settings.ENABLE_HSTS or (
            settings.ENVIRONMENT in ("production", "staging") and request.url.scheme == "https"
        ):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


# Enforce explicit, configured CORS origins (never unrestricted wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Application-level maximum request body size limit
app.add_middleware(RequestBodyLimitMiddleware)

# HTTP defense-in-depth security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Structured request/response logging middleware
app.add_middleware(LoggingMiddleware)


# Domain exception handlers for clean RESTful error mapping
@app.exception_handler(ResourceNotFoundError)
async def resource_not_found_handler(request: Request, exc: ResourceNotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": exc.message, "entity": exc.entity_name, "identifier": exc.identifier},
    )


@app.exception_handler(InvalidStateTransitionError)
async def invalid_transition_handler(
    request: Request, exc: InvalidStateTransitionError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "detail": exc.message,
            "current_status": exc.current_status,
            "target_status": exc.target_status,
        },
    )


@app.exception_handler(DuplicateIdempotencyKeyError)
async def duplicate_idempotency_handler(
    request: Request, exc: DuplicateIdempotencyKeyError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": exc.message, "idempotency_key": exc.idempotency_key},
    )


@app.exception_handler(EstimationUnavailableError)
async def estimation_unavailable_handler(
    request: Request, exc: EstimationUnavailableError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": exc.message, "reason": exc.reason},
    )


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": exc.message},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Safe fail-closed 500 handler preventing database/stack trace disclosure
    and credential leakage.
    """
    sanitized_error = sanitize_sensitive_text(str(exc))
    logger.error(
        "unhandled_server_error",
        path=request.url.path,
        method=request.method,
        error=sanitized_error,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# Root-level health check endpoint for AWS ALB targets
app.add_api_route("/health", check_health, methods=["GET"], include_in_schema=False)

# Mount versioned API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    """Root info response."""
    return {
        "service": settings.PROJECT_NAME,
        "docs_url": f"{settings.API_V1_STR}/docs",
        "health_url": f"{settings.API_V1_STR}/health",
    }
