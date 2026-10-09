"""Google OpenID Connect identity token verification module."""

from typing import Any

from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import get_settings
from app.domain.exceptions import DomainError


def verify_google_id_token(
    token: str,
    request_adapter: Any = None,
    client_id_override: str | None = None,
) -> dict[str, Any]:
    """Cryptographically verifies a Google ID token and validates claims.

    Enforces:
    - Non-empty token and configured GOOGLE_CLIENT_ID
    - Cryptographic signature against Google's published public keys
    - Issuer is 'accounts.google.com' or 'https://accounts.google.com'
    - Audience matches configured GOOGLE_CLIENT_ID
    - Token has not expired (expiry / time claims)
    - Usable stable subject identifier ('sub')
    - Email claim present and 'email_verified' is True
    """
    settings = get_settings()
    client_id = client_id_override or settings.GOOGLE_CLIENT_ID

    if not client_id:
        raise DomainError(
            "Google Authentication is not configured on the server (missing GOOGLE_CLIENT_ID)."
        )

    if not token or not isinstance(token, str) or not token.strip():
        raise DomainError("Missing or empty Google ID token.")

    try:
        # Create transport adapter for Google's public key cache if none provided
        request = request_adapter if request_adapter is not None else google_requests.Request()

        payload = id_token.verify_oauth2_token(
            token.strip(),
            request,
            audience=client_id,
        )
    except ValueError as exc:
        # Cryptographic verification failure, expired token, wrong audience, wrong issuer, etc.
        raise DomainError(f"Google ID token verification failed: {exc}") from exc
    except (TransportError, GoogleAuthError) as exc:
        # Network failure or upstream provider issue fetching Google signing certificates
        raise DomainError(
            f"Failed to verify Google token due to network/provider error: {exc}"
        ) from exc
    except Exception as exc:
        raise DomainError(f"Unexpected error verifying Google ID token: {exc}") from exc

    # Validate issuer explicitly
    issuer = payload.get("iss")
    if issuer not in ("accounts.google.com", "https://accounts.google.com"):
        raise DomainError(f"Invalid token issuer '{issuer}'. Expected Google issuer.")

    # Validate audience explicitly
    aud = payload.get("aud")
    if aud != client_id:
        raise DomainError(f"Invalid audience '{aud}'. Expected '{client_id}'.")

    # Validate subject identifier 'sub'
    sub = payload.get("sub")
    if not sub or not isinstance(sub, str) or not sub.strip():
        raise DomainError("Token is missing a valid subject ('sub') claim.")

    # Validate email and email_verified
    email = payload.get("email")
    if not email or not isinstance(email, str) or not email.strip():
        raise DomainError("Token is missing a valid email address.")

    email_verified = payload.get("email_verified")
    if email_verified is not True:
        raise DomainError("Google account email is not verified.")

    return {
        "sub": sub.strip(),
        "email": email.strip().lower(),
        "name": payload.get("name") or payload.get("given_name") or email.split("@")[0],
        "email_verified": True,
        "picture": payload.get("picture"),
    }
