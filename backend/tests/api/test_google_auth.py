"""Comprehensive test suite for Google OpenID Connect Citizen Authentication (M6.2)."""

import asyncio
from unittest.mock import patch

import httpx
import pytest
from google.auth.exceptions import TransportError
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import async_session_factory
from app.domain.enums import UserRole
from app.domain.exceptions import DomainError
from app.domain.models import User, UserIdentity
from app.services.auth_service import AuthService

TEST_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com"


@pytest.fixture(autouse=True)
def configure_google_auth(monkeypatch: pytest.MonkeyPatch):
    """Configures Google Auth environment settings for test runs."""
    settings = get_settings()
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", TEST_CLIENT_ID)
    monkeypatch.setattr(settings, "GOOGLE_AUTH_ENABLED", True)


def _mock_google_payload(
    sub: str = "google-sub-10001",
    email: str = "rahul.citizen@example.com",
    name: str = "Rahul Sharma",
    email_verified: bool = True,
    aud: str = TEST_CLIENT_ID,
    iss: str = "https://accounts.google.com",
) -> dict:
    return {
        "iss": iss,
        "aud": aud,
        "sub": sub,
        "email": email,
        "email_verified": email_verified,
        "name": name,
    }


class TestGoogleCitizenAuthentication:
    """Tests all aspects of Google OpenID Connect Citizen Authentication."""

    async def test_valid_google_token_creates_citizen(self, client: httpx.AsyncClient):
        """Verifies valid Google ID token creates new CITIZEN account and returns JWT."""
        payload = _mock_google_payload(
            sub="google-sub-12345",
            email="aarav.verma@example.com",
            name="Aarav Verma",
        )

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "valid.mock.id_token"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "aarav.verma@example.com"
        assert data["user"]["full_name"] == "Aarav Verma"
        assert data["user"]["role"] == "CITIZEN"

        # Verify access token authenticates protected endpoints
        me_resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {data['access_token']}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "aarav.verma@example.com"
        assert me_resp.json()["role"] == "CITIZEN"

    async def test_repeat_signin_resolves_same_identity(self, client: httpx.AsyncClient):
        """Verifies repeated sign-in with same Google sub resolves identical user ID."""
        payload_1 = _mock_google_payload(
            sub="google-sub-fixed-id",
            email="priya.patel@example.com",
            name="Priya Patel",
        )

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload_1):
            resp_1 = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "valid.token.1"},
            )

        assert resp_1.status_code == 200
        user_id_1 = resp_1.json()["user"]["id"]

        # Sign in again with potentially updated name
        payload_2 = _mock_google_payload(
            sub="google-sub-fixed-id",
            email="priya.patel@example.com",
            name="Priya K. Patel",
        )

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload_2):
            resp_2 = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "valid.token.2"},
            )

        assert resp_2.status_code == 200
        user_id_2 = resp_2.json()["user"]["id"]
        assert user_id_1 == user_id_2
        assert resp_2.json()["user"]["full_name"] == "Priya K. Patel"

    async def test_invalid_signature_rejected(self, client: httpx.AsyncClient):
        """Verifies token with invalid signature raises 401 Unauthorized."""
        with patch(
            "google.oauth2.id_token.verify_oauth2_token",
            side_effect=ValueError("Invalid cryptographic signature"),
        ):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "tampered.jwt.token"},
            )

        assert resp.status_code == 401
        assert "verification failed" in resp.json()["detail"].lower()

    async def test_wrong_issuer_rejected(self, client: httpx.AsyncClient):
        """Verifies token from untrusted issuer is rejected."""
        payload = _mock_google_payload(iss="https://untrusted.issuer.com")

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "wrong.issuer.token"},
            )

        assert resp.status_code == 401
        assert "invalid token issuer" in resp.json()["detail"].lower()

    async def test_wrong_audience_rejected(self, client: httpx.AsyncClient):
        """Verifies token intended for a different audience/app is rejected."""
        payload = _mock_google_payload(aud="another-client-id.apps.googleusercontent.com")

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "wrong.audience.token"},
            )

        assert resp.status_code == 401
        assert "invalid audience" in resp.json()["detail"].lower()

    async def test_expired_token_rejected(self, client: httpx.AsyncClient):
        """Verifies expired Google token is rejected."""
        with patch(
            "google.oauth2.id_token.verify_oauth2_token",
            side_effect=ValueError("Token expired"),
        ):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "expired.jwt.token"},
            )

        assert resp.status_code == 401
        assert "verification failed" in resp.json()["detail"].lower()

    async def test_unverified_email_rejected(self, client: httpx.AsyncClient):
        """Verifies token with email_verified=False is rejected."""
        payload = _mock_google_payload(email_verified=False)

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "unverified.email.token"},
            )

        assert resp.status_code == 401
        assert "email is not verified" in resp.json()["detail"].lower()

    async def test_missing_subject_claim_rejected(self, client: httpx.AsyncClient):
        """Verifies token with missing sub claim is rejected."""
        payload = _mock_google_payload(sub="")

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "missing.sub.token"},
            )

        assert resp.status_code == 401
        assert "missing a valid subject" in resp.json()["detail"].lower()

    async def test_provider_network_failure_handled_gracefully(self, client: httpx.AsyncClient):
        """Verifies network transport failure fetching Google certs returns 401 safely."""
        with patch(
            "google.oauth2.id_token.verify_oauth2_token",
            side_effect=TransportError("Failed to fetch Google signing certificates"),
        ):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "network.failure.token"},
            )

        assert resp.status_code == 401
        assert "network/provider error" in resp.json()["detail"].lower()

    async def test_staff_account_cannot_downgrade_or_login_via_google_citizen(
        self, client: httpx.AsyncClient, make_user
    ):
        """Verifies staff accounts (OPERATOR/ADMIN) cannot login via citizen Google endpoint."""
        # Create an existing OPERATOR staff account
        await make_user("operator.rajesh@queless.gov.in", role=UserRole.OPERATOR)

        payload = _mock_google_payload(
            sub="google-sub-operator-hacker",
            email="operator.rajesh@queless.gov.in",
            name="Operator Rajesh",
        )

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "operator.spoofed.token"},
            )

        assert resp.status_code == 403
        assert "staff accounts must sign in via the staff portal" in resp.json()["detail"].lower()

    async def test_admin_staff_account_cannot_login_via_google_citizen(
        self, client: httpx.AsyncClient, make_user
    ):
        """Verifies ADMIN staff accounts cannot login via citizen Google endpoint."""
        await make_user("admin.super@queless.gov.in", role=UserRole.ADMIN)

        payload = _mock_google_payload(
            sub="google-sub-admin-hacker",
            email="admin.super@queless.gov.in",
            name="Admin Super",
        )

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "admin.spoofed.token"},
            )

        assert resp.status_code == 403
        assert "staff accounts must sign in via the staff portal" in resp.json()["detail"].lower()

    async def test_email_collision_does_not_silently_link_password_account(
        self, client: httpx.AsyncClient, make_user
    ):
        """Verifies that an existing password citizen account is not silently hijacked/linked."""
        # Create a citizen with password authentication
        await make_user("citizen.existing@example.com", role=UserRole.CITIZEN)

        # Google login arrives with matching email but no linked federated identity
        payload = _mock_google_payload(
            sub="new-google-sub-unlinked",
            email="citizen.existing@example.com",
            name="Citizen Impersonator",
        )

        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
            resp = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "unlinked.google.token"},
            )

        assert resp.status_code == 409
        assert "silent account linking is disabled" in resp.json()["detail"].lower()

    async def test_client_supplied_role_or_privileges_rejected(self, client: httpx.AsyncClient):
        """Verifies client cannot pass arbitrary role or service attributes."""
        resp = await client.post(
            "/api/v1/auth/google",
            json={
                "id_token": "valid.token",
                "role": "ADMIN",
                "assigned_service_id": "00000000-0000-0000-0000-000000000000",
            },
        )
        assert resp.status_code == 422  # Extra fields forbidden

    async def test_google_auth_fails_when_configuration_absent(
        self, client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
    ):
        """Verifies Google auth endpoint fails closed (HTTP 503) when server config is missing."""
        settings = get_settings()
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", None)

        resp = await client.post(
            "/api/v1/auth/google",
            json={"id_token": "any.token"},
        )
        assert resp.status_code == 503
        assert "not configured on the server" in resp.json()["detail"]

    async def test_google_config_endpoint(self, client: httpx.AsyncClient):
        """Verifies GET /api/v1/auth/google/config returns enabled status and client ID."""
        resp = await client.get("/api/v1/auth/google/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is True
        assert data["client_id"] == TEST_CLIENT_ID

    async def test_google_config_endpoint_when_disabled(
        self, client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
    ):
        """Verifies GET /api/v1/auth/google/config safely returns
        enabled=False and client_id=None when disabled.
        """
        settings = get_settings()
        monkeypatch.setattr(settings, "GOOGLE_AUTH_ENABLED", False)
        resp = await client.get("/api/v1/auth/google/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is False
        assert data["client_id"] is None

    async def test_concurrent_first_signins_prevent_duplicate_accounts(self):
        """Verifies concurrent first sign-ins resolve cleanly without duplicates or crashes."""
        email = "concurrent.citizen@example.com"
        sub = "google-sub-concurrent-test"
        payload = _mock_google_payload(
            sub=sub,
            email=email,
            name="Concurrent Citizen",
        )

        async def sign_in_worker():
            async with async_session_factory() as session:
                svc = AuthService(session)
                with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
                    return await svc.authenticate_google_user("dummy.id.token")

        # Launch 5 workers concurrently to stress race conditions
        results = await asyncio.gather(*[sign_in_worker() for _ in range(5)])

        first_user_id = results[0][0].id
        for user, token in results:
            assert user.id == first_user_id
            assert user.role == UserRole.CITIZEN
            assert token is not None

        # Confirm exactly 1 user row and 1 user_identity row exist in database
        async with async_session_factory() as session:
            users = (await session.execute(select(User).where(User.email == email))).scalars().all()
            identities = (
                (
                    await session.execute(
                        select(UserIdentity).where(
                            UserIdentity.provider == "google",
                            UserIdentity.provider_subject == sub,
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(users) == 1
            assert len(identities) == 1
            assert identities[0].user_id == first_user_id

    async def test_distinct_google_subjects_same_email_rejected(self, client: httpx.AsyncClient):
        """Verifies two different Google subjects attempting to use the same email are rejected."""
        email = "shared.identity@example.com"

        # User A signs in first with Google sub-A
        payload_a = _mock_google_payload(
            sub="google-sub-user-a",
            email=email,
            name="User Alpha",
        )
        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload_a):
            resp_a = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "token.user.a"},
            )
        assert resp_a.status_code == 200

        # User B attempts to sign in with Google sub-B but same email
        payload_b = _mock_google_payload(
            sub="google-sub-user-b",
            email=email,
            name="User Beta Impersonator",
        )
        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload_b):
            resp_b = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "token.user.b"},
            )

        assert resp_b.status_code == 409
        assert "silent account linking is disabled" in resp_b.json()["detail"].lower()

    async def test_concurrent_distinct_google_subjects_same_email_rejected(self):
        """Verifies concurrent first sign-ins with different Google subjects on the same
        email safely reject the second sign-in.
        """
        email = "concurrent.distinct.subs@example.com"

        payload_a = _mock_google_payload(
            sub="google-sub-distinct-alpha",
            email=email,
            name="Alpha User",
        )
        payload_b = _mock_google_payload(
            sub="google-sub-distinct-beta",
            email=email,
            name="Beta User",
        )

        async def sign_in_worker(payload: dict):
            async with async_session_factory() as session:
                svc = AuthService(session)
                with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
                    return await svc.authenticate_google_user("dummy.id.token")

        results = await asyncio.gather(
            sign_in_worker(payload_a),
            sign_in_worker(payload_b),
            return_exceptions=True,
        )

        # Exactly one must succeed and one must fail with DomainError
        successes = [r for r in results if not isinstance(r, Exception)]
        failures = [r for r in results if isinstance(r, Exception)]

        assert len(successes) == 1
        assert len(failures) == 1
        assert isinstance(failures[0], DomainError)
        assert "silent account linking is disabled" in str(failures[0]).lower()

    async def test_deterministic_interleaved_first_signins_resolve_cleanly(self):
        """Deterministically reproduces the exact interleaving of the concurrency race:
        1. Worker B checks for UserIdentity and finds none.
        2. Worker B pauses before checking User by email (via asyncio.Event).
        3. Worker A runs to completion: creates and commits User + UserIdentity.
        4. Worker B resumes, checks User by email, finds existing_user, verifies
           the linked UserIdentity matches the same Google sub, and resolves cleanly.
        """
        email = "interleaved.same.sub@example.com"
        sub = "google-sub-interleaved-same"
        payload = _mock_google_payload(
            sub=sub,
            email=email,
            name="Interleaved Citizen",
        )

        worker_b_checked_identity = asyncio.Event()
        worker_a_committed = asyncio.Event()

        async def worker_a():
            await worker_b_checked_identity.wait()
            async with async_session_factory() as session_a:
                svc_a = AuthService(session_a)
                with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
                    res = await svc_a.authenticate_google_user("dummy.token.a")
            worker_a_committed.set()
            return res

        async def worker_b():
            async with async_session_factory() as session_b:
                original_execute = session_b.execute
                query_count = 0

                async def intercepted_execute(statement, *args, **kwargs):
                    nonlocal query_count
                    result = await original_execute(statement, *args, **kwargs)
                    query_count += 1
                    if query_count == 1:
                        worker_b_checked_identity.set()
                        await worker_a_committed.wait()
                    return result

                session_b.execute = intercepted_execute
                svc_b = AuthService(session_b)
                with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload):
                    return await svc_b.authenticate_google_user("dummy.token.b")

        res_a, res_b = await asyncio.gather(worker_a(), worker_b())

        user_a, token_a = res_a
        user_b, token_b = res_b

        assert user_a.id == user_b.id
        assert user_a.role == UserRole.CITIZEN
        assert user_b.role == UserRole.CITIZEN
        assert token_a is not None
        assert token_b is not None

        # Verify DB state: exactly 1 user and 1 identity
        async with async_session_factory() as session:
            users = (await session.execute(select(User).where(User.email == email))).scalars().all()
            identities = (
                (
                    await session.execute(
                        select(UserIdentity).where(
                            UserIdentity.provider == "google",
                            UserIdentity.provider_subject == sub,
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(users) == 1
            assert len(identities) == 1
            assert identities[0].user_id == user_a.id

    async def test_deterministic_interleaved_distinct_subs_rejected(self):
        """Deterministically reproduces interleaving when two distinct Google subjects
        share the same email:
        1. Worker B (sub B) checks for UserIdentity and finds none.
        2. Worker B pauses before checking User by email.
        3. Worker A (sub A) creates and commits User + UserIdentity.
        4. Worker B resumes, encounters existing_user, finds sub B does not match
           the linked identity, and raises DomainError (HTTP 409).
        """
        email = "interleaved.distinct.subs@example.com"
        sub_a = "google-sub-interleaved-alpha"
        sub_b = "google-sub-interleaved-beta"
        payload_a = _mock_google_payload(sub=sub_a, email=email, name="Alpha User")
        payload_b = _mock_google_payload(sub=sub_b, email=email, name="Beta User")

        worker_b_checked_identity = asyncio.Event()
        worker_a_committed = asyncio.Event()

        async def worker_a():
            await worker_b_checked_identity.wait()
            async with async_session_factory() as session_a:
                svc_a = AuthService(session_a)
                with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload_a):
                    res = await svc_a.authenticate_google_user("dummy.token.a")
            worker_a_committed.set()
            return res

        async def worker_b():
            async with async_session_factory() as session_b:
                original_execute = session_b.execute
                query_count = 0

                async def intercepted_execute(statement, *args, **kwargs):
                    nonlocal query_count
                    result = await original_execute(statement, *args, **kwargs)
                    query_count += 1
                    if query_count == 1:
                        worker_b_checked_identity.set()
                        await worker_a_committed.wait()
                    return result

                session_b.execute = intercepted_execute
                svc_b = AuthService(session_b)
                with patch("google.oauth2.id_token.verify_oauth2_token", return_value=payload_b):
                    return await svc_b.authenticate_google_user("dummy.token.b")

        results = await asyncio.gather(worker_a(), worker_b(), return_exceptions=True)

        user_a, token_a = results[0]
        exc_b = results[1]

        assert user_a.role == UserRole.CITIZEN
        assert isinstance(exc_b, DomainError)
        assert "silent account linking is disabled" in str(exc_b).lower()
