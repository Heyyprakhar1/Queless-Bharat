"""Authentication and identity endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user
from app.core.config import get_settings
from app.core.rate_limit import rate_limit_auth_login, rate_limit_auth_register
from app.db.session import get_db
from app.domain.exceptions import DomainError, ResourceNotFoundError
from app.domain.models import User
from app.schemas.auth import (
    AdminCreateUserRequest,
    CitizenAccessRequest,
    CitizenRegisterRequest,
    GoogleAuthConfigResponse,
    GoogleAuthRequest,
    StaffRegisterRequest,
    TokenResponse,
    UserLoginRequest,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get(
    "/google/config",
    response_model=GoogleAuthConfigResponse,
    status_code=status.HTTP_200_OK,
)
async def google_auth_config() -> GoogleAuthConfigResponse:
    """Returns Google client configuration status for frontend client initialization."""
    settings = get_settings()
    is_enabled = bool(settings.GOOGLE_AUTH_ENABLED and settings.GOOGLE_CLIENT_ID)
    return GoogleAuthConfigResponse(
        enabled=is_enabled,
        client_id=settings.GOOGLE_CLIENT_ID if is_enabled else None,
    )


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limit_auth_login)],
)
async def google_auth(
    data: GoogleAuthRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Authenticates a citizen via Google OpenID Connect ID token."""
    auth_svc = AuthService(db)
    try:
        user, token = await auth_svc.authenticate_google_user(data.id_token)
    except DomainError as exc:
        msg = str(exc)
        if "not configured" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=msg,
            ) from exc
        if "Staff accounts" in msg or "Privileged staff accounts" in msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=msg,
            ) from exc
        if "already exists" in msg.lower() or "conflict" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=msg,
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=msg,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/citizen-access",
    status_code=status.HTTP_410_GONE,
    dependencies=[Depends(rate_limit_auth_login)],
)
async def citizen_access(
    data: CitizenAccessRequest | None = None,
) -> dict[str, str]:
    """Retired unauthenticated citizen-access endpoint.

    Citizen identities must be verified through Google OpenID Connect (/auth/google).
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "The unauthenticated citizen-access endpoint has been retired. "
            "Please authenticate using Google via /api/v1/auth/google."
        ),
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_auth_register)],
)
async def register(
    data: CitizenRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Public registration for citizens. Role is strictly assigned as CITIZEN."""
    auth_svc = AuthService(db)
    try:
        user = await auth_svc.register_citizen(data)
    except DomainError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return UserResponse.model_validate(user)


@router.post(
    "/staff-register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_auth_register)],
)
async def request_staff_registration(
    data: StaffRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Public staff access request. Creates a pending account with is_active=False.
    Must be reviewed and activated by an Administrator before login is permitted.
    """
    auth_svc = AuthService(db)
    try:
        user = await auth_svc.request_staff_account(data)
    except DomainError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return UserResponse.model_validate(user)


@router.post(
    "/admin/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_privileged_user(
    data: AdminCreateUserRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
) -> UserResponse:
    """Administrator-only workflow for provisioning privileged or scoped accounts
    (OPERATOR, ADMIN).
    """
    auth_svc = AuthService(db)
    try:
        user = await auth_svc.create_privileged_user(data)
    except DomainError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return UserResponse.model_validate(user)


@router.get(
    "/admin/users",
    response_model=list[UserResponse],
    status_code=status.HTTP_200_OK,
)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
    is_active: bool | None = None,
) -> list[UserResponse]:
    """Administrator-only: list all registered identities, optionally filtered by active status."""
    auth_svc = AuthService(db)
    users = await auth_svc.list_users(is_active=is_active)
    return [UserResponse.model_validate(u) for u in users]


@router.post(
    "/admin/users/{user_id}/activate",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
async def activate_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
) -> UserResponse:
    """Administrator-only: approve/activate a pending staff or inactive user account."""
    auth_svc = AuthService(db)
    try:
        user = await auth_svc.activate_user(user_id)
    except ResourceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limit_auth_login)],
)
async def login(
    data: UserLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Authenticate with email and password, returning a signed JWT access token."""
    auth_svc = AuthService(db)
    try:
        user, token = await auth_svc.authenticate_user(data.email, data.password)
    except DomainError as exc:
        msg = str(exc)
        if "pending administrator approval" in msg or "inactive" in msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=msg,
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=msg,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Retrieve identity profile of current authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
)
async def logout(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Client-side token invalidation acknowledgment."""
    return {"status": "ok", "message": f"User {current_user.email} successfully logged out"}
