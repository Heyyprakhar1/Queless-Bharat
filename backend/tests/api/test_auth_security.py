"""Milestone 4 Security Suite: Authentication, RBAC, and BOLA Authorization."""

import uuid
from datetime import timedelta

import httpx

from app.core.security import create_access_token
from app.domain.enums import UserRole


class TestAuthenticationSecurity:
    """Tests registration, credential verification, JWT mechanics, and error responses."""

    async def test_register_and_login_success(self, client: httpx.AsyncClient):
        """Verifies full registration and authentication cycle."""
        # 1. Register new citizen
        reg_resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "sunil.verma@example.com",
                "password": "SecurePassword123!",
                "full_name": "Sunil Verma",
                "role": "CITIZEN",
            },
        )
        assert reg_resp.status_code == 201
        reg_data = reg_resp.json()
        assert reg_data["email"] == "sunil.verma@example.com"
        assert reg_data["role"] == "CITIZEN"
        assert "password" not in reg_data
        assert "hashed_password" not in reg_data

        # 2. Login with valid credentials
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "sunil.verma@example.com",
                "password": "SecurePassword123!",
            },
        )
        assert login_resp.status_code == 200
        token_data = login_resp.json()
        assert "access_token" in token_data
        assert token_data["token_type"] == "bearer"
        assert token_data["user"]["email"] == "sunil.verma@example.com"

        # 3. Verify me endpoint with token
        headers = {"Authorization": f"Bearer {token_data['access_token']}"}
        me_resp = await client.get("/api/v1/auth/me", headers=headers)
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "sunil.verma@example.com"

    async def test_duplicate_registration_rejected(self, client: httpx.AsyncClient, make_user):
        """Verifies duplicate email registration is rejected with 409 Conflict."""
        await make_user("duplicate@example.com", role=UserRole.CITIZEN)

        dup_resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "SecurePassword123!",
                "full_name": "Duplicate User",
            },
        )
        assert dup_resp.status_code == 409
        assert "already exists" in dup_resp.json()["detail"]

    async def test_invalid_login_credentials(self, client: httpx.AsyncClient, make_user):
        """Verifies wrong password or nonexistent user returns 401 Unauthorized."""
        await make_user(
            "existing@example.com", role=UserRole.CITIZEN, password="CorrectPassword123!"
        )

        # Wrong password
        bad_pw = await client.post(
            "/api/v1/auth/login",
            json={"email": "existing@example.com", "password": "WrongPassword!"},
        )
        assert bad_pw.status_code == 401
        assert "Invalid email or password" in bad_pw.json()["detail"]

        # Unknown email
        unknown_email = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "AnyPassword!"},
        )
        assert unknown_email.status_code == 401

    async def test_inactive_user_login_rejected(self, client: httpx.AsyncClient, make_user):
        """Verifies deactivated accounts cannot login."""
        await make_user(
            "inactive@example.com",
            role=UserRole.CITIZEN,
            is_active=False,
            password="Password123!",
        )
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "inactive@example.com", "password": "Password123!"},
        )
        assert resp.status_code == 401
        assert "inactive" in resp.json()["detail"]

    async def test_token_validation_and_expiration(
        self, unauth_client: httpx.AsyncClient, make_user
    ):
        """Verifies missing, malformed, and expired JWT tokens return 401."""
        user, valid_token, valid_headers = await make_user("jwt.test@example.com")

        # Missing token
        res_no_auth = await unauth_client.get("/api/v1/auth/me")
        assert res_no_auth.status_code == 401

        # Malformed token
        res_bad_token = await unauth_client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-valid-jwt"}
        )
        assert res_bad_token.status_code == 401

        # Expired token
        expired_token = create_access_token(
            subject=str(user.id),
            role=user.role,
            expires_delta=timedelta(seconds=-10),  # expired 10s ago
        )
        res_expired = await unauth_client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert res_expired.status_code == 401
        assert "expired" in res_expired.json()["detail"].lower()


class TestRoleBasedAuthorization:
    """Verifies RBAC enforcement between CITIZEN, OPERATOR, and ADMIN roles."""

    async def test_admin_only_endpoints(
        self, unauth_client: httpx.AsyncClient, admin_auth, operator_auth, citizen_auth
    ):
        """Verifies non-admin roles cannot create locations or services (403 Forbidden)."""
        _, _, admin_hdrs = admin_auth
        _, _, op_hdrs = operator_auth
        _, _, cit_hdrs = citizen_auth

        loc_payload = {
            "name": "District Hospital",
            "category": "hospital",
            "address": "Ring Road",
            "city": "Bhopal",
            "state": "Madhya Pradesh",
        }

        # 1. Unauthenticated -> 401
        resp_unauth = await unauth_client.post("/api/v1/locations", json=loc_payload)
        assert resp_unauth.status_code == 401

        # 2. Citizen -> 403 Forbidden
        resp_cit = await unauth_client.post("/api/v1/locations", json=loc_payload, headers=cit_hdrs)
        assert resp_cit.status_code == 403

        # 3. Operator -> 403 Forbidden
        resp_op = await unauth_client.post("/api/v1/locations", json=loc_payload, headers=op_hdrs)
        assert resp_op.status_code == 403

        # 4. Admin -> 201 Created
        resp_admin = await unauth_client.post(
            "/api/v1/locations", json=loc_payload, headers=admin_hdrs
        )
        assert resp_admin.status_code == 201
        loc_id = resp_admin.json()["id"]

        # Same for Service creation
        svc_payload = {"location_id": loc_id, "name": "Dental Clinic"}
        assert (
            await unauth_client.post("/api/v1/services", json=svc_payload, headers=cit_hdrs)
        ).status_code == 403
        assert (
            await unauth_client.post("/api/v1/services", json=svc_payload, headers=op_hdrs)
        ).status_code == 403
        assert (
            await unauth_client.post("/api/v1/services", json=svc_payload, headers=admin_hdrs)
        ).status_code == 201

    async def test_operator_only_endpoints(
        self, client: httpx.AsyncClient, admin_auth, operator_auth, citizen_auth
    ):
        """Verifies citizens cannot invoke operator desk endpoints (start, complete)."""
        _, _, admin_hdrs = admin_auth
        _, _, op_hdrs = operator_auth
        _, _, cit_hdrs = citizen_auth

        # Setup facility via admin
        loc = (
            await client.post(
                "/api/v1/locations",
                json={
                    "name": "Gov Hospital",
                    "category": "hospital",
                    "address": "MG Road",
                    "city": "Indore",
                    "state": "MP",
                },
                headers=admin_hdrs,
            )
        ).json()
        svc = (
            await client.post(
                "/api/v1/services",
                json={"location_id": loc["id"], "name": "Cardiology"},
                headers=admin_hdrs,
            )
        ).json()

        # Citizen checks in
        ticket = (
            await client.post(
                "/api/v1/queue/check-in",
                json={"service_id": svc["id"]},
                headers=cit_hdrs,
            )
        ).json()

        # Citizen attempts to start service -> 403 Forbidden
        bad_start = await client.post(f"/api/v1/queue/{ticket['id']}/start", headers=cit_hdrs)
        assert bad_start.status_code == 403

        # Citizen attempts to complete service -> 403 Forbidden
        bad_comp = await client.post(f"/api/v1/queue/{ticket['id']}/complete", headers=cit_hdrs)
        assert bad_comp.status_code == 403

        # Operator starts service -> 200 OK
        good_start = await client.post(f"/api/v1/queue/{ticket['id']}/start", headers=op_hdrs)
        assert good_start.status_code == 200
        assert good_start.json()["status"] == "IN_SERVICE"


class TestResourceLevelAuthorizationBOLA:
    """Verifies resource ownership and BOLA / IDOR protection across citizens and operators."""

    async def test_citizen_cannot_view_or_cancel_other_citizen_ticket(
        self, client: httpx.AsyncClient, admin_auth, make_user
    ):
        """Verifies Citizen B cannot access Citizen A's queue session (IDOR/BOLA)."""
        _, _, admin_hdrs = admin_auth
        user_a, _, hdrs_a = await make_user("citizen.a@example.com", role=UserRole.CITIZEN)
        user_b, _, hdrs_b = await make_user("citizen.b@example.com", role=UserRole.CITIZEN)

        # Create service
        loc = (
            await client.post(
                "/api/v1/locations",
                json={
                    "name": "RTO Bhopal",
                    "category": "rto",
                    "address": "Kolar",
                    "city": "Bhopal",
                    "state": "MP",
                },
                headers=admin_hdrs,
            )
        ).json()
        svc = (
            await client.post(
                "/api/v1/services",
                json={"location_id": loc["id"], "name": "Licence Issue"},
                headers=admin_hdrs,
            )
        ).json()

        # Citizen A joins queue
        ticket_a = (
            await client.post(
                "/api/v1/queue/check-in",
                json={"service_id": svc["id"]},
                headers=hdrs_a,
            )
        ).json()
        assert ticket_a["user_uuid"] == str(user_a.id)

        # Citizen A can view own status
        view_a = await client.get(f"/api/v1/queue/{ticket_a['id']}/status", headers=hdrs_a)
        assert view_a.status_code == 200

        # Citizen B attempts to view Citizen A's status -> 403 Forbidden
        view_b = await client.get(f"/api/v1/queue/{ticket_a['id']}/status", headers=hdrs_b)
        assert view_b.status_code == 403
        assert "not authorized" in view_b.json()["detail"].lower()

        # Citizen B attempts to cancel Citizen A's ticket -> 403 Forbidden
        cancel_b = await client.post(f"/api/v1/queue/{ticket_a['id']}/cancel", headers=hdrs_b)
        assert cancel_b.status_code == 403
        assert "not authorized" in cancel_b.json()["detail"].lower()

        # Citizen A cancels own ticket -> 200 OK
        cancel_a = await client.post(f"/api/v1/queue/{ticket_a['id']}/cancel", headers=hdrs_a)
        assert cancel_a.status_code == 200
        assert cancel_a.json()["status"] == "CANCELLED"

    async def test_operator_scoped_to_assigned_service(
        self, client: httpx.AsyncClient, admin_auth, make_user
    ):
        """Verifies Operator assigned to Service 1 cannot operate tickets in Service 2."""
        _, _, admin_hdrs = admin_auth

        # 1. Setup Location and two different Services
        loc = (
            await client.post(
                "/api/v1/locations",
                json={
                    "name": "District Hospital",
                    "category": "hospital",
                    "address": "Station Rd",
                    "city": "Jabalpur",
                    "state": "MP",
                },
                headers=admin_hdrs,
            )
        ).json()
        svc1 = (
            await client.post(
                "/api/v1/services",
                json={"location_id": loc["id"], "name": "General OPD"},
                headers=admin_hdrs,
            )
        ).json()
        svc2 = (
            await client.post(
                "/api/v1/services",
                json={"location_id": loc["id"], "name": "Dental Clinic"},
                headers=admin_hdrs,
            )
        ).json()

        # 2. Operator assigned specifically to Service 1
        _, _, op1_hdrs = await make_user(
            "op1@hospital.gov.in",
            role=UserRole.OPERATOR,
            assigned_service_id=uuid.UUID(svc1["id"]),
        )

        # 3. Citizen joins Service 2 (Dental)
        _, _, citizen_hdrs = await make_user("citizen.patient@example.com", role=UserRole.CITIZEN)
        ticket_svc2 = (
            await client.post(
                "/api/v1/queue/check-in",
                json={"service_id": svc2["id"]},
                headers=citizen_hdrs,
            )
        ).json()

        # 4. Operator 1 attempts to start ticket in Service 2 -> 403 Forbidden (BOLA protected)
        unauth_start = await client.post(
            f"/api/v1/queue/{ticket_svc2['id']}/start", headers=op1_hdrs
        )
        assert unauth_start.status_code == 403
        assert "not assigned to this service" in unauth_start.json()["detail"].lower()

        # 5. Citizen joins Service 1 (General OPD)
        ticket_svc1 = (
            await client.post(
                "/api/v1/queue/check-in",
                json={"service_id": svc1["id"]},
                headers=citizen_hdrs,
            )
        ).json()

        # 6. Operator 1 starts ticket in Service 1 -> 200 OK
        auth_start = await client.post(f"/api/v1/queue/{ticket_svc1['id']}/start", headers=op1_hdrs)
        assert auth_start.status_code == 200
        assert auth_start.json()["status"] == "IN_SERVICE"
