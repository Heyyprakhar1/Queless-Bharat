"""Cryptographic and token security utilities for QueuelessBharat."""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings

settings = get_settings()


def get_password_hash(password: str) -> str:
    """Securely hashes plaintext password with salted bcrypt."""
    pw_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Safely verifies plaintext password against salted bcrypt hash.

    Uses constant-time comparison to prevent timing attacks.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(
    subject: str,
    role: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Creates a cryptographically signed HMAC-SHA256 JWT access token."""
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    claims: dict[str, Any] = {
        "sub": str(subject),
        "role": str(role),
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
    }
    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(
        claims,
        settings.AUTH_SECRET_KEY,
        algorithm=settings.AUTH_ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodes, verifies signature, and validates claims of an incoming JWT."""
    return jwt.decode(
        token,
        settings.AUTH_SECRET_KEY,
        algorithms=[settings.AUTH_ALGORITHM],
        options={"require": ["exp", "sub", "role"]},
        leeway=10,
    )
