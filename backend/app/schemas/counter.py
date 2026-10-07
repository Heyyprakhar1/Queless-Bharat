"""Counter schemas and validation models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import CounterStatus


class CounterCreate(BaseModel):
    """Payload to register a new counter window under a service."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=100)
    status: CounterStatus = CounterStatus.ACTIVE


class CounterResponse(BaseModel):
    """Public representation of a physical/logical counter window."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    service_id: uuid.UUID
    name: str
    status: str
    created_at: datetime
    updated_at: datetime
