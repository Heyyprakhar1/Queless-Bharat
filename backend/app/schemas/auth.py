"""Pydantic schemas for authentication and identity management."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domain.enums import UserRole


class CitizenRegisterRequest(BaseModel):
    """Payload for public citizen registration. Strictly unprivileged."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=1, max_length=255)


class StaffRegisterRequest(BaseModel):
    """Payload for self-service staff account request.
    Strictly creates an unapproved, inactive account (is_active=False) with role OPERATOR.
    Must be reviewed and activated by an Administrator before login is permitted.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=1, max_length=255)
    department_note: str | None = Field(
        default=None,
        max_length=500,
        description="Optional note describing facility or counter role",
    )


class CitizenAccessRequest(BaseModel):
    """Payload for low-friction citizen onboarding and demo session access."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr


class GoogleAuthRequest(BaseModel):
    """Payload for citizen Sign in with Google verification."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    id_token: str = Field(..., min_length=1, description="Google OpenID Connect ID token")


class GoogleAuthConfigResponse(BaseModel):
    """Public configuration state for Google authentication."""

    enabled: bool
    client_id: str | None = None


# Alias for backward compatibility
UserRegisterRequest = CitizenRegisterRequest


class AdminCreateUserRequest(BaseModel):
    """Payload for administrator creating privileged or assigned identities."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = Field(
        default=UserRole.CITIZEN,
        description="Assigned role: CITIZEN, OPERATOR, or ADMIN",
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
