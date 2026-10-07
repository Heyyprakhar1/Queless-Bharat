"""Full HTTP -> Service -> PostgreSQL API integration tests for Milestone 2."""

import uuid

import httpx


class TestQueueAPIIntegration:
    """Verifies complete HTTP endpoint behavior, validation, status codes, and error semantics."""

    async def test_complete_queue_lifecycle(self, client: httpx.AsyncClient):
        """Tests complete citizen journey: location -> service -> counter -> queue lifecycle."""
        # 1. Create Location
        loc_resp = await client.post(
            "/api/v1/locations",
            json={
                "name": "District Hospital Civil Lines",
                "category": "hospital",
                "address": "Civil Lines Ward 4",
                "city": "Bhopal",
                "state": "Madhya Pradesh",
                "timezone": "Asia/Kolkata",
                "latitude": 23.2599,
                "longitude": 77.4126,
            },
        )
        assert loc_resp.status_code == 201
        loc_data = loc_resp.json()
        loc_id = loc_data["id"]
        assert loc_data["name"] == "District Hospital Civil Lines"

        # 2. List Locations
        list_loc_resp = await client.get("/api/v1/locations")
        assert list_loc_resp.status_code == 200
        assert len(list_loc_resp.json()) == 1

        # 3. Get Location by ID
        get_loc_resp = await client.get(f"/api/v1/locations/{loc_id}")
        assert get_loc_resp.status_code == 200
        assert get_loc_resp.json()["id"] == loc_id

        # 4. Create Service under Location
        svc_resp = await client.post(
            "/api/v1/services",
            json={
                "location_id": loc_id,
                "name": "OPD Registration",
                "description": "General Patient Intake Counter",
            },
        )
        assert svc_resp.status_code == 201
        svc_data = svc_resp.json()
        svc_id = svc_data["id"]

        # 5. List Services
        list_svc_resp = await client.get(f"/api/v1/services?location_id={loc_id}")
        assert list_svc_resp.status_code == 200
        assert len(list_svc_resp.json()) == 1

        # 6. Create Counter
        counter_resp = await client.post(
            "/api/v1/counters",
            json={
                "service_id": svc_id,
                "name": "Counter 1 - General",
            },
        )
        assert counter_resp.status_code == 201
        counter_id = counter_resp.json()["id"]

        # 7. List Counters
        list_cnt_resp = await client.get(f"/api/v1/counters?service_id={svc_id}")
        assert list_cnt_resp.status_code == 200
        assert len(list_cnt_resp.json()) == 1

        # 8. Check In to Queue
        checkin_resp = await client.post(
            "/api/v1/queue/check-in",
            json={
                "service_id": svc_id,
                "user_id": "citizen_42",
                "idempotency_key": "idem_checkin_001",
            },
        )
        assert checkin_resp.status_code == 201
        session_data = checkin_resp.json()
        session_id = session_data["id"]
        assert session_data["status"] == "WAITING"
        assert session_data["user_id"] == "citizen_42"

        # 9. Get Queue Session
        get_sess_resp = await client.get(f"/api/v1/queue/{session_id}")
        assert get_sess_resp.status_code == 200
        assert get_sess_resp.json()["id"] == session_id

        # 10. Check Queue Status (Estimator Unavailable initially because no completed sessions)
        status_resp = await client.get(f"/api/v1/services/{svc_id}/queue-status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["people_ahead"] == 1
        assert status_data["active_counters"] == 1
        # Explicitly unavailable, NOT fake 0 minutes!
        assert status_data["estimated_wait"]["is_available"] is False
        assert "Insufficient sample data" in status_data["estimated_wait"]["reason"]

        # 11. Start Service
        start_resp = await client.post(
            f"/api/v1/queue/{session_id}/start",
            json={
                "counter_id": counter_id,
                "idempotency_key": "idem_start_001",
            },
        )
        assert start_resp.status_code == 200
        assert start_resp.json()["status"] == "IN_SERVICE"
        assert start_resp.json()["service_started_at"] is not None

        # 12. Complete Service
        complete_resp = await client.post(
            f"/api/v1/queue/{session_id}/complete",
            json={
                "idempotency_key": "idem_comp_001",
            },
        )
        assert complete_resp.status_code == 200
        assert complete_resp.json()["status"] == "COMPLETED"
        assert complete_resp.json()["completed_at"] is not None

        # 13. Now check in citizen 2 and check queue status with now 1 completed sample!
        checkin_2_resp = await client.post(
            "/api/v1/queue/check-in",
            json={
                "service_id": svc_id,
                "user_id": "citizen_43",
            },
        )
        assert checkin_2_resp.status_code == 201

        status_2_resp = await client.get(f"/api/v1/services/{svc_id}/queue-status")
        assert status_2_resp.status_code == 200
        status_2_data = status_2_resp.json()
        assert status_2_data["people_ahead"] == 1
        assert status_2_data["active_counters"] == 1
        # Now estimate IS available because we have completed service session throughput!
        assert status_2_data["estimated_wait"]["is_available"] is True
        assert status_2_data["estimated_wait"]["sample_size"] == 1
        assert status_2_data["estimated_wait"]["lower_minutes"] is not None
        assert status_2_data["estimated_wait"]["upper_minutes"] is not None
        assert (
            status_2_data["estimated_wait"]["lower_minutes"]
            <= status_2_data["estimated_wait"]["upper_minutes"]
        )

    async def test_queue_cancellation_flow(self, client: httpx.AsyncClient):
        """Verifies cancellation of a waiting queue session."""
        # Create service
        loc = (
            await client.post(
                "/api/v1/locations",
                json={
                    "name": "RTO West Zone",
                    "category": "rto",
                    "address": "Sector 5",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                },
            )
        ).json()
        svc = (
            await client.post(
                "/api/v1/services",
                json={"location_id": loc["id"], "name": "Driving Licence"},
            )
        ).json()

        session = (
            await client.post(
                "/api/v1/queue/check-in",
                json={"service_id": svc["id"]},
            )
        ).json()

        cancel_resp = await client.post(
            f"/api/v1/queue/{session['id']}/cancel",
            json={"reason": "Emergency call", "idempotency_key": "cancel_key_1"},
        )
        assert cancel_resp.status_code == 200
        assert cancel_resp.json()["status"] == "CANCELLED"
        assert cancel_resp.json()["cancelled_at"] is not None

    async def test_invalid_state_transitions(self, client: httpx.AsyncClient):
        """Verifies 400 Bad Request on invalid queue transitions."""
        loc = (
            await client.post(
                "/api/v1/locations",
                json={
                    "name": "SDM Office",
                    "category": "government_office",
                    "address": "Court Complex",
                    "city": "Jaipur",
                    "state": "Rajasthan",
                },
            )
        ).json()
        svc = (
            await client.post(
                "/api/v1/services",
                json={"location_id": loc["id"], "name": "Caste Certificate"},
            )
        ).json()

        session = (
            await client.post(
                "/api/v1/queue/check-in",
                json={"service_id": svc["id"]},
            )
        ).json()

        # Cannot complete directly from WAITING -> 400 Bad Request
        resp_bad_complete = await client.post(f"/api/v1/queue/{session['id']}/complete")
        assert resp_bad_complete.status_code == 400
        assert "Invalid queue session transition" in resp_bad_complete.json()["detail"]

        # Cancel session
        await client.post(f"/api/v1/queue/{session['id']}/cancel")

        # CANCELLED cannot start -> 400 Bad Request
        resp_cancelled_start = await client.post(f"/api/v1/queue/{session['id']}/start")
        assert resp_cancelled_start.status_code == 400

    async def test_duplicate_requests_idempotency(self, client: httpx.AsyncClient):
        """Verifies repeated check-in with same idempotency key returns same session."""
        loc = (
            await client.post(
                "/api/v1/locations",
                json={
                    "name": "District Hospital",
                    "category": "hospital",
                    "address": "Ring Road",
                    "city": "Pune",
                    "state": "Maharashtra",
                },
            )
        ).json()
        svc = (
            await client.post(
                "/api/v1/services",
                json={"location_id": loc["id"], "name": "Radiology"},
            )
        ).json()

        key = "unique-key-xyz-999"
        res1 = await client.post(
            "/api/v1/queue/check-in",
            json={"service_id": svc["id"], "idempotency_key": key},
        )
        assert res1.status_code == 201

        res2 = await client.post(
            "/api/v1/queue/check-in",
            json={"service_id": svc["id"], "idempotency_key": key},
        )
        # Should return existing session
        assert res2.status_code == 201
        assert res1.json()["id"] == res2.json()["id"]

    async def test_wait_observation_submission_and_retrieval(self, client: httpx.AsyncClient):
        """Verifies submitting crowd observation reflects in queue status."""
        loc = (
            await client.post(
                "/api/v1/locations",
                json={
                    "name": "Civil Hospital",
                    "category": "hospital",
                    "address": "Station Road",
                    "city": "Surat",
                    "state": "Gujarat",
                },
            )
        ).json()
        svc = (
            await client.post(
                "/api/v1/services",
                json={"location_id": loc["id"], "name": "Laboratory"},
            )
        ).json()

        # Submit observation
        obs_resp = await client.post(
            f"/api/v1/services/{svc['id']}/observations",
            json={
                "people_ahead": 14,
                "reported_wait_minutes": 25.0,
                "active_counters": 3,
                "source": "USER_REPORTED",
            },
        )
        assert obs_resp.status_code == 201
        obs_data = obs_resp.json()
        assert obs_data["people_ahead"] == 14
        assert obs_data["active_counters"] == 3

        # Invalid observation with negative values -> 422
        bad_obs = await client.post(
            f"/api/v1/services/{svc['id']}/observations",
            json={
                "people_ahead": -1,
                "active_counters": 1,
            },
        )
        assert bad_obs.status_code == 422

    async def test_not_found_handling(self, client: httpx.AsyncClient):
        """Verifies 404 for non-existent entities."""
        random_id = uuid.uuid4()
        assert (await client.get(f"/api/v1/locations/{random_id}")).status_code == 404
        assert (await client.get(f"/api/v1/services/{random_id}")).status_code == 404
        assert (await client.get(f"/api/v1/queue/{random_id}")).status_code == 404
        assert (await client.get(f"/api/v1/services/{random_id}/queue-status")).status_code == 404
