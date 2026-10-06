"""Health and readiness check response schemas."""

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    """Minimal health contract without exposing internal infrastructure details."""

    model_config = ConfigDict(frozen=True)

    status: str
    database: str
    environment: str
