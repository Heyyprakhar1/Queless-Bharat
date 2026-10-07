"""Pydantic schemas for authentication and identity management."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domain.enums import UserRole


class UserRegisterRequest(BaseModel):
    """Payload to register a new user identity."""

    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = Field(
        default=UserRole.CITIZEN,
        description="Role: CITIZEN, OPERATOR, or ADMIN",
    )
    assigned_service_id: uuid.UUID | None = Field(
        default=None,
        description="Optional service assigned to operator for resource-level authorization",
    )


class UserLoginRequest(BaseModel):
    """Payload for user login."""

    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    """Public representation of an authenticated user identity."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    assigned_service_id: uuid.UUID | None
    created_at: datetime


class TokenResponse(BaseModel):
    """JWT bearer token response on successful authentication."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
