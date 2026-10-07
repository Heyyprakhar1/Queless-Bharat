"""Service schemas and validation models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import ServiceStatus


class ServiceCreate(BaseModel):
    """Payload to register a new service queue under a location."""

    model_config = ConfigDict(str_strip_whitespace=True)

    location_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    status: ServiceStatus = ServiceStatus.ACTIVE


class ServiceResponse(BaseModel):
    """Public representation of a service entity."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    location_id: uuid.UUID
    name: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime
