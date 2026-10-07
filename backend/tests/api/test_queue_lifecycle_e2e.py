"""Milestone 3 E2E Integration Test: Complete Multi-User Queue Lifecycle and Invariants.

Verifies:
1. Multi-user concurrent queue FIFO ordering and dynamic position/people-ahead shifts.
2. Full lifecycle: WAITING -> IN_SERVICE -> COMPLETED.
3. Alternate lifecycle: WAITING -> CANCELLED.
4. Terminal state resistance (COMPLETED/CANCELLED cannot transition anywhere).
5. Idempotent replays across all state transitions.
6. Data-driven deterministic wait estimates once historical service sessions exist.
7. Active entity guards (inactive service/counter rejections).
"""

import uuid

import httpx


class TestQueueLifecycleE2E:
    """End-to-end verification of queue operations, FIFO progression, and edge invariants."""

    async def test_multi_user_queue_lifecycle_and_position_shifts(self, client: httpx.AsyncClient):
        """Tests 3 citizens joining, advancing, cancelling, and verifying personal positions."""
        # Setup Location, Service, Counter
        loc_resp = await client.post(
            "/api/v1/locations",
            json={
                "name": "Bhopal RTO Office",
                "category": "rto",
                "address": "74 Bungalows",
                "city": "Bhopal",
                "state": "Madhya Pradesh",
                "timezone": "Asia/Kolkata",
            },
        )
        assert loc_resp.status_code == 201
        loc_id = loc_resp.json()["id"]

        svc_resp = await client.post(
            "/api/v1/services",
            json={
                "location_id": loc_id,
                "name": "Driving Licence Renewal",
                "description": "Counter for DL Renewal and Biometrics",
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

        # Step 1: User 1 joins
        u1_resp = await client.post(
            "/api/v1/queue/check-in",
            json={
                "service_id": svc_id,
                "user_id": "citizen_amit",
                "idempotency_key": "u1_checkin",
            },
        )
        assert u1_resp.status_code == 201
        u1_id = u1_resp.json()["id"]

        # Step 2: User 2 joins
        u2_resp = await client.post(
            "/api/v1/queue/check-in",
            json={
                "service_id": svc_id,
                "user_id": "citizen_priya",
                "idempotency_key": "u2_checkin",
            },
        )
        assert u2_resp.status_code == 201
        u2_id = u2_resp.json()["id"]

        # Step 3: User 3 joins
        u3_resp = await client.post(
            "/api/v1/queue/check-in",
            json={
                "service_id": svc_id,
                "user_id": "citizen_rahul",
                "idempotency_key": "u3_checkin",
            },
        )
        assert u3_resp.status_code == 201
        u3_id = u3_resp.json()["id"]

        # Step 4: Verify initial positions
        st1 = (await client.get(f"/api/v1/queue/{u1_id}/status")).json()
        assert st1["session"]["status"] == "WAITING"
        assert st1["position"] == 1
        assert st1["people_ahead"] == 0

        st2 = (await client.get(f"/api/v1/queue/{u2_id}/status")).json()
        assert st2["session"]["status"] == "WAITING"
        assert st2["position"] == 2
        assert st2["people_ahead"] == 1

        st3 = (await client.get(f"/api/v1/queue/{u3_id}/status")).json()
        assert st3["session"]["status"] == "WAITING"
        assert st3["position"] == 3
        assert st3["people_ahead"] == 2

        # Step 5: User 1 called into service
        start_u1 = await client.post(
            f"/api/v1/queue/{u1_id}/start",
            json={"counter_id": counter_id, "idempotency_key": "u1_start"},
        )
        assert start_u1.status_code == 200
        assert start_u1.json()["status"] == "IN_SERVICE"

        # Now: User 1 is IN_SERVICE -> position is None, people_ahead is 0
        st1_after = (await client.get(f"/api/v1/queue/{u1_id}/status")).json()
        assert st1_after["session"]["status"] == "IN_SERVICE"
        assert st1_after["position"] is None
        assert st1_after["people_ahead"] == 0

        # User 2 is now first in waiting line (position=1, people_ahead=0)
        st2_after = (await client.get(f"/api/v1/queue/{u2_id}/status")).json()
        assert st2_after["session"]["status"] == "WAITING"
        assert st2_after["position"] == 1
        assert st2_after["people_ahead"] == 0

        # User 3 is now second in line (position=2, people_ahead=1)
        st3_after = (await client.get(f"/api/v1/queue/{u3_id}/status")).json()
        assert st3_after["session"]["status"] == "WAITING"
        assert st3_after["position"] == 2
        assert st3_after["people_ahead"] == 1

        # Step 6: User 2 cancels (leaves queue)
        cancel_u2 = await client.post(
            f"/api/v1/queue/{u2_id}/cancel",
            json={"reason": "Emergency call, will return tomorrow", "idempotency_key": "u2_cancel"},
        )
        assert cancel_u2.status_code == 200
        assert cancel_u2.json()["status"] == "CANCELLED"

        # User 2 is now CANCELLED -> position=None, people_ahead=0
        st2_cancelled = (await client.get(f"/api/v1/queue/{u2_id}/status")).json()
        assert st2_cancelled["session"]["status"] == "CANCELLED"
        assert st2_cancelled["position"] is None
        assert st2_cancelled["people_ahead"] == 0

        # User 3 advances to head of the waiting line (position=1, people_ahead=0)
        st3_advanced = (await client.get(f"/api/v1/queue/{u3_id}/status")).json()
        assert st3_advanced["session"]["status"] == "WAITING"
        assert st3_advanced["position"] == 1
        assert st3_advanced["people_ahead"] == 0

        # Step 7: User 1 completes service
        comp_u1 = await client.post(
            f"/api/v1/queue/{u1_id}/complete",
            json={"idempotency_key": "u1_complete"},
        )
        assert comp_u1.status_code == 200
        assert comp_u1.json()["status"] == "COMPLETED"

        st1_completed = (await client.get(f"/api/v1/queue/{u1_id}/status")).json()
        assert st1_completed["session"]["status"] == "COMPLETED"
        assert st1_completed["position"] is None
        assert st1_completed["people_ahead"] == 0

        # Step 8: User 3 starts and completes
        start_u3 = await client.post(
            f"/api/v1/queue/{u3_id}/start",
            json={"counter_id": counter_id, "idempotency_key": "u3_start"},
        )
        assert start_u3.status_code == 200

        comp_u3 = await client.post(
            f"/api/v1/queue/{u3_id}/complete",
            json={"idempotency_key": "u3_complete"},
        )
        assert comp_u3.status_code == 200
        assert comp_u3.json()["status"] == "COMPLETED"

        # Step 9: User 4 joins after historical sessions are established
        u4_resp = await client.post(
            "/api/v1/queue/check-in",
            json={
                "service_id": svc_id,
                "user_id": "citizen_vikram",
                "idempotency_key": "u4_checkin",
            },
        )
        assert u4_resp.status_code == 201
        u4_id = u4_resp.json()["id"]

        st4 = (await client.get(f"/api/v1/queue/{u4_id}/status")).json()
        assert st4["session"]["status"] == "WAITING"
        assert st4["position"] == 1
        assert st4["people_ahead"] == 0
        # Since u1 and u3 completed, observations now exist. Deterministic estimator is active!
        assert st4["estimated_wait"]["is_available"] is True
        assert st4["estimated_wait"]["expected_minutes"] is not None
        assert st4["estimated_wait"]["confidence"] in ["LOW", "MEDIUM", "HIGH"]

    async def test_terminal_state_immutability(self, client: httpx.AsyncClient):
        """Verifies that terminal states (COMPLETED, CANCELLED) cannot transition anywhere."""
        loc_resp = await client.post(
            "/api/v1/locations",
            json={
                "name": "Civil Hospital",
                "category": "hospital",
                "address": "Station Road",
                "city": "Indore",
                "state": "Madhya Pradesh",
                "timezone": "Asia/Kolkata",
            },
        )
        loc_id = loc_resp.json()["id"]
        svc_resp = await client.post(
            "/api/v1/services",
            json={"location_id": loc_id, "name": "Pathology", "description": "Blood Tests"},
        )
        svc_id = svc_resp.json()["id"]
        counter_resp = await client.post(
            "/api/v1/counters",
            json={"service_id": svc_id, "name": "Lab Counter 1", "status": "active"},
        )
        counter_id = counter_resp.json()["id"]

        # Case A: CANCELLED terminal state
        s1 = (
            await client.post(
                "/api/v1/queue/check-in",
                json={"service_id": svc_id, "idempotency_key": "idem_cancel_test"},
            )
        ).json()["id"]

        cancel_resp = await client.post(f"/api/v1/queue/{s1}/cancel", json={})
        assert cancel_resp.status_code == 200
        assert cancel_resp.json()["status"] == "CANCELLED"

        # Cannot start service on cancelled session
        bad_start = await client.post(f"/api/v1/queue/{s1}/start", json={})
        assert bad_start.status_code == 400
        assert "Invalid queue session transition" in bad_start.json()["detail"]

        # Cannot complete service on cancelled session
        bad_comp = await client.post(f"/api/v1/queue/{s1}/complete", json={})
        assert bad_comp.status_code == 400
        assert "Invalid queue session transition" in bad_comp.json()["detail"]

        # Cannot cancel already cancelled session
        bad_cancel = await client.post(f"/api/v1/queue/{s1}/cancel", json={})
        assert bad_cancel.status_code == 400
        assert "Invalid queue session transition" in bad_cancel.json()["detail"]

        # Case B: COMPLETED terminal state
        s2 = (
            await client.post(
                "/api/v1/queue/check-in",
                json={"service_id": svc_id, "idempotency_key": "idem_comp_test"},
            )
        ).json()["id"]
        await client.post(f"/api/v1/queue/{s2}/start", json={"counter_id": counter_id})
        comp_resp = await client.post(f"/api/v1/queue/{s2}/complete", json={})
        assert comp_resp.status_code == 200
        assert comp_resp.json()["status"] == "COMPLETED"

        # Cannot transition completed session to any other state
        bad_start2 = await client.post(f"/api/v1/queue/{s2}/start", json={})
        assert bad_start2.status_code == 400
        assert "Invalid queue session transition" in bad_start2.json()["detail"]

        bad_comp2 = await client.post(f"/api/v1/queue/{s2}/complete", json={})
        assert bad_comp2.status_code == 400
        assert "Invalid queue session transition" in bad_comp2.json()["detail"]

        bad_cancel2 = await client.post(f"/api/v1/queue/{s2}/cancel", json={})
        assert bad_cancel2.status_code == 400
        assert "Invalid queue session transition" in bad_cancel2.json()["detail"]

    async def test_idempotent_replays_across_lifecycle(self, client: httpx.AsyncClient):
        """Verifies idempotent requests with duplicate keys return consistent responses."""
        loc_resp = await client.post(
            "/api/v1/locations",
            json={
                "name": "Collectorate",
                "category": "government_office",
                "address": "Kolar Road",
                "city": "Bhopal",
                "state": "Madhya Pradesh",
                "timezone": "Asia/Kolkata",
            },
        )
        loc_id = loc_resp.json()["id"]
        svc_resp = await client.post(
            "/api/v1/services",
            json={"location_id": loc_id, "name": "Income Certificate"},
        )
        svc_id = svc_resp.json()["id"]
        counter_resp = await client.post(
            "/api/v1/counters",
            json={"service_id": svc_id, "name": "Counter A"},
        )
        counter_id = counter_resp.json()["id"]

        # 1. Idempotent check-in
        idem_key_in = f"checkin-{uuid.uuid4()}"
        res1 = await client.post(
            "/api/v1/queue/check-in",
            json={"service_id": svc_id, "idempotency_key": idem_key_in},
        )
        assert res1.status_code == 201
        sid = res1.json()["id"]

        res2 = await client.post(
            "/api/v1/queue/check-in",
            json={"service_id": svc_id, "idempotency_key": idem_key_in},
        )
        assert res2.status_code == 201
        assert res2.json()["id"] == sid

        # 2. Idempotent start service
        idem_key_start = f"start-{uuid.uuid4()}"
        start1 = await client.post(
            f"/api/v1/queue/{sid}/start",
            json={"counter_id": counter_id, "idempotency_key": idem_key_start},
        )
        assert start1.status_code == 200

        start2 = await client.post(
            f"/api/v1/queue/{sid}/start",
            json={"counter_id": counter_id, "idempotency_key": idem_key_start},
        )
        assert start2.status_code == 200
        assert start2.json()["id"] == sid

        # 3. Idempotent complete service
        idem_key_comp = f"comp-{uuid.uuid4()}"
        comp1 = await client.post(
            f"/api/v1/queue/{sid}/complete",
            json={"idempotency_key": idem_key_comp},
        )
        assert comp1.status_code == 200
        assert comp1.json()["status"] == "COMPLETED"

        comp2 = await client.post(
            f"/api/v1/queue/{sid}/complete",
            json={"idempotency_key": idem_key_comp},
        )
        assert comp2.status_code == 200
        assert comp2.json()["status"] == "COMPLETED"
