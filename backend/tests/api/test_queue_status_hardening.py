"""API Contract Hardening and Queue Status Correctness tests covering all 12 Phase 3 scenarios."""

import uuid

import httpx
import pytest


@pytest.fixture
async def setup_facility(client: httpx.AsyncClient) -> tuple[str, str, str]:
    """Helper fixture creating a location, active service, and active counter."""
    loc_resp = await client.post(
        "/api/v1/locations",
        json={
            "name": "District Hospital Civil Lines",
            "category": "hospital",
            "address": "Civil Lines Ward 4",
            "city": "Bhopal",
            "state": "Madhya Pradesh",
        },
    )
    assert loc_resp.status_code == 201
    loc_id = loc_resp.json()["id"]

    svc_resp = await client.post(
        "/api/v1/services",
        json={
            "location_id": loc_id,
            "name": "General OPD",
            "status": "active",
        },
    )
    assert svc_resp.status_code == 201
    svc_id = svc_resp.json()["id"]

    counter_resp = await client.post(
        "/api/v1/counters",
        json={
            "service_id": svc_id,
            "name": "Counter 1",
            "status": "active",
        },
    )
    assert counter_resp.status_code == 201
    counter_id = counter_resp.json()["id"]

    return loc_id, svc_id, counter_id


class TestAPIContractHardening:
    """Verifies strict input bounds, whitespace rejection, and inactive entity protections."""

    async def test_whitespace_string_rejection(self, client: httpx.AsyncClient):
        """Whitespace-only strings must be stripped and fail min_length=1 validation."""
        # Location name is whitespace only
        resp = await client.post(
            "/api/v1/locations",
            json={
                "name": "   ",
                "category": "hospital",
                "address": "Road 1",
                "city": "Delhi",
                "state": "Delhi",
            },
        )
        assert resp.status_code == 422

        # Service name is whitespace only
        resp_svc = await client.post(
            "/api/v1/services",
            json={
                "location_id": str(uuid.uuid4()),
                "name": "   \t",
            },
        )
        assert resp_svc.status_code == 422

    async def test_inactive_service_check_in_rejection(
        self, client: httpx.AsyncClient, setup_facility: tuple[str, str, str]
    ):
        """Inactive services must reject new queue check-ins with 400 Bad Request."""
        loc_id, _, _ = setup_facility
        # Create inactive service
        inactive_svc = (
            await client.post(
                "/api/v1/services",
                json={
                    "location_id": loc_id,
                    "name": "Night Clinic",
                    "status": "inactive",
                },
            )
        ).json()

        resp = await client.post(
            "/api/v1/queue/check-in",
            json={"service_id": inactive_svc["id"]},
        )
        assert resp.status_code == 400
        assert "inactive and cannot accept check-ins" in resp.json()["detail"]

    async def test_inactive_counter_start_rejection(
        self, client: httpx.AsyncClient, setup_facility: tuple[str, str, str]
    ):
        """Starting service on an inactive counter must be rejected with 400 Bad Request."""
        _, svc_id, _ = setup_facility
        # Create maintenance counter
        inactive_counter = (
            await client.post(
                "/api/v1/counters",
                json={
                    "service_id": svc_id,
                    "name": "Counter 9 - Maintenance",
                    "status": "maintenance",
                },
            )
        ).json()

        # Check in participant
        session = (
            await client.post(
                "/api/v1/queue/check-in",
                json={"service_id": svc_id},
            )
        ).json()

        # Start service with maintenance counter -> 400 Bad Request
        resp = await client.post(
            f"/api/v1/queue/{session['id']}/start",
            json={"counter_id": inactive_counter["id"]},
        )
        assert resp.status_code == 400
        assert "not active" in resp.json()["detail"]


class TestQueueStatusCorrectnessMatrix:
    """Verifies all 12 realistic queue status situations specified in Milestone 3 Phase 3."""

    # 1. Empty queue
    async def test_situation_01_empty_queue(
        self, client: httpx.AsyncClient, setup_facility: tuple[str, str, str]
    ):
        _, svc_id, _ = setup_facility
        resp = await client.get(f"/api/v1/services/{svc_id}/queue-status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["people_ahead"] == 0
        assert data["queue_state"]["waiting_count"] == 0
        # When queue is empty with active counter, wait is 0.0 mins
        assert data["estimated_wait"]["is_available"] is True
        assert data["estimated_wait"]["expected_minutes"] == 0.0

    # 2. One person waiting & 4. User at first position
    async def test_situation_02_and_04_one_person_at_first_position(
        self, client: httpx.AsyncClient, setup_facility: tuple[str, str, str]
    ):
        _, svc_id, _ = setup_facility
        chk = (await client.post("/api/v1/queue/check-in", json={"service_id": svc_id})).json()
        sess_id = chk["id"]

        user_status_resp = await client.get(f"/api/v1/queue/{sess_id}/status")
        assert user_status_resp.status_code == 200
        data = user_status_resp.json()
        assert data["position"] == 1
        assert data["people_ahead"] == 0
        assert data["queue_state"]["waiting_count"] == 1
        # First person in line with active counter can be served immediately
        assert data["estimated_wait"]["is_available"] is True
        assert data["estimated_wait"]["expected_minutes"] == 0.0
        assert data["estimated_wait"]["confidence"] == "HIGH"

    # 3, 5, 6. Multiple people waiting: user at first, middle, and end
    async def test_situation_03_05_06_multiple_waiting_positions(
        self, client: httpx.AsyncClient, setup_facility: tuple[str, str, str]
    ):
        _, svc_id, counter_id = setup_facility
        # Add 1 completed throughput session first (5 minutes duration = 300 seconds)
        dummy = (await client.post("/api/v1/queue/check-in", json={"service_id": svc_id})).json()
        await client.post(f"/api/v1/queue/{dummy['id']}/start", json={"counter_id": counter_id})
        await client.post(f"/api/v1/queue/{dummy['id']}/complete")

        # Now 3 users join queue in sequence
        u1 = (
            await client.post(
                "/api/v1/queue/check-in", json={"service_id": svc_id, "user_id": "u1"}
            )
        ).json()
        u2 = (
            await client.post(
                "/api/v1/queue/check-in", json={"service_id": svc_id, "user_id": "u2"}
            )
        ).json()
        u3 = (
            await client.post(
                "/api/v1/queue/check-in", json={"service_id": svc_id, "user_id": "u3"}
            )
        ).json()

        # Check U1 (first in line)
        st1 = (await client.get(f"/api/v1/queue/{u1['id']}/status")).json()
        assert st1["position"] == 1
        assert st1["people_ahead"] == 0
        assert st1["estimated_wait"]["expected_minutes"] == 0.0

        # Check U2 (middle)
        st2 = (await client.get(f"/api/v1/queue/{u2['id']}/status")).json()
        assert st2["position"] == 2
        assert st2["people_ahead"] == 1
        assert st2["estimated_wait"]["is_available"] is True
        assert st2["estimated_wait"]["expected_minutes"] is not None
        assert st2["estimated_wait"]["expected_minutes"] > 0

        # Check U3 (end)
        st3 = (await client.get(f"/api/v1/queue/{u3['id']}/status")).json()
        assert st3["position"] == 3
        assert st3["people_ahead"] == 2
        assert st3["estimated_wait"]["is_available"] is True
        assert st3["estimated_wait"]["expected_minutes"] is not None
        # U3 wait must be greater than U2 wait
        assert st3["estimated_wait"]["expected_minutes"] > st2["estimated_wait"]["expected_minutes"]

    # 7. User already in service
    async def test_situation_07_user_already_in_service(
        self, client: httpx.AsyncClient, setup_facility: tuple[str, str, str]
    ):
        _, svc_id, counter_id = setup_facility
        sess = (await client.post("/api/v1/queue/check-in", json={"service_id": svc_id})).json()
        await client.post(f"/api/v1/queue/{sess['id']}/start", json={"counter_id": counter_id})

        resp = await client.get(f"/api/v1/queue/{sess['id']}/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session"]["status"] == "IN_SERVICE"
        assert data["position"] is None
        assert data["people_ahead"] == 0
        assert data["estimated_wait"]["reason"] == "Currently in service"

    # 8. User completed
    async def test_situation_08_user_completed(
        self, client: httpx.AsyncClient, setup_facility: tuple[str, str, str]
    ):
        _, svc_id, counter_id = setup_facility
        sess = (await client.post("/api/v1/queue/check-in", json={"service_id": svc_id})).json()
        await client.post(f"/api/v1/queue/{sess['id']}/start", json={"counter_id": counter_id})
        await client.post(f"/api/v1/queue/{sess['id']}/complete")

        resp = await client.get(f"/api/v1/queue/{sess['id']}/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session"]["status"] == "COMPLETED"
        assert data["position"] is None
        assert data["people_ahead"] == 0
        assert data["estimated_wait"]["is_available"] is False
        assert data["estimated_wait"]["reason"] == "Service completed"

    # 9. User cancelled
    async def test_situation_09_user_cancelled(
        self, client: httpx.AsyncClient, setup_facility: tuple[str, str, str]
    ):
        _, svc_id, _ = setup_facility
        sess = (await client.post("/api/v1/queue/check-in", json={"service_id": svc_id})).json()
        await client.post(
            f"/api/v1/queue/{sess['id']}/cancel", json={"reason": "User changed mind"}
        )

        resp = await client.get(f"/api/v1/queue/{sess['id']}/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session"]["status"] == "CANCELLED"
        assert data["position"] is None
        assert data["people_ahead"] == 0
        assert data["estimated_wait"]["is_available"] is False
        assert data["estimated_wait"]["reason"] == "Queue session cancelled"

    # 10. Insufficient historical throughput data
    async def test_situation_10_insufficient_throughput_data(
        self, client: httpx.AsyncClient, setup_facility: tuple[str, str, str]
    ):
        _, svc_id, _ = setup_facility
        # Check in 2 participants with zero completed sessions in database
        _ = (await client.post("/api/v1/queue/check-in", json={"service_id": svc_id})).json()
        u2 = (await client.post("/api/v1/queue/check-in", json={"service_id": svc_id})).json()

        # U2 has 1 person ahead, but 0 completed sessions exist
        resp = await client.get(f"/api/v1/queue/{u2['id']}/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["people_ahead"] == 1
        assert data["estimated_wait"]["is_available"] is False
        assert "Insufficient sample data" in data["estimated_wait"]["reason"]

    # 11. Queue session not found
    async def test_situation_11_queue_session_not_found(self, client: httpx.AsyncClient):
        random_id = uuid.uuid4()
        resp = await client.get(f"/api/v1/queue/{random_id}/status")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    # 12. Stale or invalid references
    async def test_situation_12_stale_or_invalid_references(self, client: httpx.AsyncClient):
        # Malformed non-UUID format -> 422
        resp_malformed = await client.get("/api/v1/queue/not-a-valid-uuid/status")
        assert resp_malformed.status_code == 422

        # Non-existent service ID on check-in -> 404
        resp_bad_svc = await client.post(
            "/api/v1/queue/check-in",
            json={"service_id": str(uuid.uuid4())},
        )
        assert resp_bad_svc.status_code == 404
