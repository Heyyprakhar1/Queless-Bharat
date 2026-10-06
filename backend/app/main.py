"""QueueLess Bharat backend application entrypoint."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.v1.endpoints.health import check_health
from app.core.config import get_settings
from app.core.logging import LoggingMiddleware, get_logger, setup_logging

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

# Enforce explicit, configured CORS origins (never unrestricted wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Structured request/response logging middleware
app.add_middleware(LoggingMiddleware)

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
