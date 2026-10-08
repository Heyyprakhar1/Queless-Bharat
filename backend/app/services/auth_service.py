"""Authentication and user management business logic."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash, verify_password
from app.domain.enums import UserRole
from app.domain.exceptions import DomainError, ResourceNotFoundError
from app.domain.models import Service, User
from app.schemas.auth import AdminCreateUserRequest, CitizenRegisterRequest


class AuthService:
    """Handles user identity registration, verification, and token issuance."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def register_citizen(self, data: CitizenRegisterRequest) -> User:
        """Public registration: strictly creates an unprivileged CITIZEN identity."""
        # 1. Uniqueness check
        stmt = select(User).where(User.email == data.email.lower())
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing:
            raise DomainError(f"User with email '{data.email}' already exists")

        # 2. Secure password hashing
        hashed_pw = get_password_hash(data.password)

        user = User(
            email=data.email.lower(),
            full_name=data.full_name,
            hashed_password=hashed_pw,
            role=UserRole.CITIZEN,
            is_active=True,
            assigned_service_id=None,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def create_privileged_user(self, data: AdminCreateUserRequest) -> User:
        """Administrator-only provisioning for privileged (OPERATOR, ADMIN) or scoped identities."""
        # 1. Uniqueness check
        stmt = select(User).where(User.email == data.email.lower())
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing:
            raise DomainError(f"User with email '{data.email}' already exists")

        # 2. Service assignment validation
        if data.assigned_service_id:
            svc_stmt = select(Service).where(Service.id == data.assigned_service_id)
            service = (await self.session.execute(svc_stmt)).scalar_one_or_none()
            if not service:
                raise ResourceNotFoundError("Service", str(data.assigned_service_id))

        # 3. Secure password hashing
        hashed_pw = get_password_hash(data.password)

        user = User(
            email=data.email.lower(),
            full_name=data.full_name,
            hashed_password=hashed_pw,
            role=data.role,
            is_active=True,
            assigned_service_id=data.assigned_service_id,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def register_user(self, data: CitizenRegisterRequest) -> User:
        """Backward-compatible alias delegating to register_citizen."""
        return await self.register_citizen(data)

    async def authenticate_user(self, email: str, password: str) -> tuple[User, str]:
        """Validates credentials and issues a signed JWT access token."""
        stmt = select(User).where(User.email == email.lower())
        user = (await self.session.execute(stmt)).scalar_one_or_none()

        if not user or not verify_password(password, user.hashed_password):
            raise DomainError("Invalid email or password")

        if not user.is_active:
            raise DomainError("Account is inactive")

        token = create_access_token(
            subject=str(user.id),
            role=user.role,
            extra_claims={"email": user.email, "name": user.full_name},
        )
        return user, token

    async def get_or_create_citizen(self, full_name: str, email: str) -> tuple[User, str]:
        """Low-friction onboarding for citizens (demo/transitional).

        Strictly grants CITIZEN role. Never elevates or grants operator/admin access.
        Staff accounts must sign in via the Staff Portal.
        """
        stmt = select(User).where(User.email == email.lower())
        user = (await self.session.execute(stmt)).scalar_one_or_none()
        if user:
            if user.role != UserRole.CITIZEN:
                raise DomainError("Staff accounts must sign in via the Staff Portal.")
            if not user.is_active:
                raise DomainError("Account is inactive")
        else:
            user = User(
                email=email.lower(),
                full_name=full_name.strip(),
                hashed_password=get_password_hash(uuid.uuid4().hex),
                role=UserRole.CITIZEN,
                is_active=True,
                assigned_service_id=None,
            )
            self.session.add(user)
            await self.session.commit()
            await self.session.refresh(user)

        token = create_access_token(
            subject=str(user.id),
            role=user.role,
            extra_claims={"email": user.email, "name": user.full_name},
        )
        return user, token

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        """Retrieves user entity by identifier."""
        stmt = select(User).where(User.id == user_id)
        return (await self.session.execute(stmt)).scalar_one_or_none()
