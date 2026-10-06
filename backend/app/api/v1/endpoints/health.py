"""Health and readiness endpoint."""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.db.session import check_db_connectivity
from app.schemas.health import HealthResponse

router = APIRouter()
settings = get_settings()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health & Readiness Check",
    description="Reports service liveness and database connectivity status.",
)
async def check_health() -> JSONResponse:
    """Verifies service responsiveness and relational database connectivity."""
    db_connected = await check_db_connectivity()

    health_status = "ok" if db_connected else "degraded"
    db_status = "connected" if db_connected else "disconnected"

    http_status = status.HTTP_200_OK if db_connected else status.HTTP_503_SERVICE_UNAVAILABLE

    response_payload = HealthResponse(
        status=health_status,
        database=db_status,
        environment=settings.ENVIRONMENT,
    )

    return JSONResponse(
        status_code=http_status,
        content=response_payload.model_dump(),
    )
