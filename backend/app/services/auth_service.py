"""Authentication and user management business logic."""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.google_auth import verify_google_id_token
from app.core.security import create_access_token, get_password_hash, verify_password
from app.domain.enums import UserRole
from app.domain.exceptions import DomainError, ResourceNotFoundError
from app.domain.models import Service, User, UserIdentity
from app.schemas.auth import (
    AdminCreateUserRequest,
    CitizenRegisterRequest,
    StaffRegisterRequest,
)


class AuthService:
    """Handles user identity registration, verification, and token issuance."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def request_staff_account(self, data: StaffRegisterRequest) -> User:
        """Self-service staff account request.
        Strictly creates an unapproved, inactive account (is_active=False) with role OPERATOR.
        Admin role cannot be self-requested.
        """
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
            role=UserRole.OPERATOR,
            is_active=False,
            assigned_service_id=None,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

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

        if (
            not user
            or not user.hashed_password
            or not verify_password(password, user.hashed_password)
        ):
            raise DomainError("Invalid email or password")

        if not user.is_active:
            raise DomainError(
                "Account is pending administrator approval or inactive. "
                "Please contact your system administrator."
            )

        token = create_access_token(
            subject=str(user.id),
            role=user.role,
            extra_claims={"email": user.email, "name": user.full_name},
        )
        return user, token

    async def authenticate_google_user(self, id_token_str: str) -> tuple[User, str]:
        """Verifies a Google OpenID Connect ID token and returns an authenticated CITIZEN session.

        - Cryptographically verifies the Google ID token.
        - Resolves user via persistent (provider, provider_subject) identity.
        - Enforces strict CITIZEN role mapping. Staff accounts must use staff portal.
        - Prevents silent account linking on email collision with password accounts.
        - Concurrency-safe: handles race conditions during initial registration.
        """
        payload = verify_google_id_token(id_token_str)
        sub = payload["sub"]
        email = payload["email"]
        full_name = payload["name"]

        # 1. Lookup external federated identity by (provider, provider_subject)
        stmt = select(UserIdentity).where(
            UserIdentity.provider == "google", UserIdentity.provider_subject == sub
        )
        identity = (await self.session.execute(stmt)).scalar_one_or_none()

        if identity:
            user = await self.get_user_by_id(identity.user_id)
            if not user:
                raise DomainError("Associated user account not found.")

            if not user.is_active:
                raise DomainError("Account is inactive")

            # Role guard: Google citizen auth can NEVER authenticate or downgrade staff accounts
            if user.role != UserRole.CITIZEN:
                raise DomainError(
                    "Privileged staff accounts cannot sign in via citizen Google authentication."
                )

            # Update provider email or name if changed
            if identity.provider_email != email:
                identity.provider_email = email
            if full_name and user.full_name != full_name:
                user.full_name = full_name
            await self.session.commit()
            await self.session.refresh(user)

        else:
            # 2. Check if an account already exists with this email
            user_stmt = select(User).where(User.email == email)
            existing_user = (await self.session.execute(user_stmt)).scalar_one_or_none()

            if existing_user:
                if existing_user.role != UserRole.CITIZEN:
                    raise DomainError("Staff accounts must sign in via the Staff Portal.")

                # Concurrency check: check if a concurrent request already linked
                # this exact Google identity
                matching_ident_stmt = select(UserIdentity).where(
                    UserIdentity.user_id == existing_user.id,
                    UserIdentity.provider == "google",
                    UserIdentity.provider_subject == sub,
                )
                matching_identity = (
                    await self.session.execute(matching_ident_stmt)
                ).scalar_one_or_none()

                if matching_identity:
                    # Concurrently created by identical Google identity
                    user = existing_user
                    if not user.is_active:
                        raise DomainError("Account is inactive")
                    if matching_identity.provider_email != email:
                        matching_identity.provider_email = email
                    if full_name and user.full_name != full_name:
                        user.full_name = full_name
                    await self.session.commit()
                    await self.session.refresh(user)
                else:
                    # Safe account-linking rule: do not silently link an existing password account
                    # or an account belonging to a different external identity
                    raise DomainError(
                        f"An existing account with email '{email}' already exists. "
                        "Silent account linking is disabled for security."
                    )
            else:
                # 3. Create new CITIZEN user and link federated identity with concurrency handling
                try:
                    user = User(
                        email=email,
                        full_name=full_name,
                        hashed_password=None,  # No password for Google-authenticated users
                        role=UserRole.CITIZEN,
                        is_active=True,
                        assigned_service_id=None,
                    )
                    self.session.add(user)
                    await self.session.flush()

                    identity = UserIdentity(
                        user_id=user.id,
                        provider="google",
                        provider_subject=sub,
                        provider_email=email,
                    )
                    self.session.add(identity)
                    await self.session.commit()
                    await self.session.refresh(user)
                except IntegrityError as exc:
                    await self.session.rollback()
                    # Concurrency race: another request created the identity or email concurrently
                    retry_stmt = select(UserIdentity).where(
                        UserIdentity.provider == "google", UserIdentity.provider_subject == sub
                    )
                    retry_identity = (await self.session.execute(retry_stmt)).scalar_one_or_none()
                    if retry_identity:
                        user = await self.get_user_by_id(retry_identity.user_id)
                        if not user or not user.is_active or user.role != UserRole.CITIZEN:
                            raise DomainError(
                                "Authentication failed during identity resolution."
                            ) from exc
                    else:
                        raise DomainError(
                            f"An existing account with email '{email}' already exists. "
                            "Silent account linking is disabled for security."
                        ) from exc

        token = create_access_token(
            subject=str(user.id),
            role=user.role,
            extra_claims={"email": user.email, "name": user.full_name},
        )
        return user, token

    async def get_or_create_citizen(self, full_name: str, email: str) -> tuple[User, str]:
        """Retired unauthenticated citizen access endpoint."""
        raise DomainError(
            "The unauthenticated citizen-access endpoint has been retired. "
            "Please use Google authentication."
        )

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        """Retrieves user entity by identifier."""
        stmt = select(User).where(User.id == user_id)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_users(self, is_active: bool | None = None) -> list[User]:
        """Lists users, optionally filtered by active status for administrator review."""
        stmt = select(User).order_by(User.created_at.desc())
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def activate_user(self, user_id: uuid.UUID) -> User:
        """Activates a pending or inactive user identity."""
        stmt = select(User).where(User.id == user_id)
        user = (await self.session.execute(stmt)).scalar_one_or_none()
        if not user:
            raise ResourceNotFoundError("User", str(user_id))
        user.is_active = True
        await self.session.commit()
        await self.session.refresh(user)
        return user
