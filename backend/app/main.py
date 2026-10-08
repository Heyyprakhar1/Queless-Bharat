"""QueueLess Bharat backend application entrypoint."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.router import api_router
from app.api.v1.endpoints.health import check_health
from app.core.config import get_settings
from app.core.logging import LoggingMiddleware, get_logger, setup_logging
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


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces standard HTTP security defense headers on all outgoing responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


# Enforce explicit, configured CORS origins (never unrestricted wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

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
    """Safe fail-closed 500 handler preventing database/stack trace disclosure."""
    logger.error(
        "unhandled_server_error",
        path=request.url.path,
        method=request.method,
        error=str(exc),
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
