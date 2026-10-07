"""Location schemas and validation models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import LocationCategory, LocationStatus


class LocationCreate(BaseModel):
    """Payload to register a new physical location."""

    name: str = Field(..., min_length=1, max_length=255)
    category: LocationCategory
    address: str = Field(..., min_length=1)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    timezone: str = Field(default="Asia/Kolkata", min_length=1, max_length=50)
    latitude: float | None = Field(default=None, ge=-90.0, le=90.0)
    longitude: float | None = Field(default=None, ge=-180.0, le=180.0)
    status: LocationStatus = LocationStatus.ACTIVE


class LocationResponse(BaseModel):
    """Public representation of a location entity."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    address: str
    city: str
    state: str
    timezone: str
    latitude: float | None
    longitude: float | None
    status: str
    created_at: datetime
    updated_at: datetime
