"""Integration API tests for Smart Visit Planner endpoint."""

import uuid

import httpx


class TestPlannerAPIIntegration:
    """Verifies HTTP behavior, responses, and validation for /services/{id}/visit-plan."""

    async def test_get_visit_plan_not_found(self, unauth_client: httpx.AsyncClient):
        """Querying a non-existent service ID returns 404 Not Found."""
        random_id = uuid.uuid4()
        response = await unauth_client.get(f"/api/v1/services/{random_id}/visit-plan")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "Service" in data["detail"]

    async def test_get_visit_plan_verified_service(self, client: httpx.AsyncClient):
        """Creates location, service, and tests /visit-plan endpoint response contract."""
        # 1. Create Location
        loc_resp = await client.post(
            "/api/v1/locations",
            json={
                "name": "Pune Regional Transport Office",
                "category": "rto",
                "address": "Alandi Road, Pune",
                "city": "Pune",
                "state": "Maharashtra",
                "timezone": "Asia/Kolkata",
            },
        )
        assert loc_resp.status_code == 201
        loc_id = loc_resp.json()["id"]

        # 2. Create Driving Licence Renewal Service
        svc_resp = await client.post(
            "/api/v1/services",
            json={
                "location_id": loc_id,
                "name": "Driving Licence Renewal & Biometrics",
                "description": "Smart Card DL Renewal Desk",
            },
        )
        assert svc_resp.status_code == 201
        svc_id = svc_resp.json()["id"]

        # 3. Call visit-plan endpoint
        plan_resp = await client.get(f"/api/v1/services/{svc_id}/visit-plan")
        assert plan_resp.status_code == 200
        plan = plan_resp.json()

        assert plan["service_id"] == svc_id
        assert plan["service_name"] == "Driving Licence Renewal & Biometrics"
        assert plan["location_name"] == "Pune Regional Transport Office"
        assert plan["city"] == "Pune"
        assert "arrival_window" in plan
        assert "document_checklist" in plan

        # Check checklist contract
        checklist = plan["document_checklist"]
        assert checklist["has_verified_checklist"] is True
        assert checklist["verification_status"] == "VERIFIED"
        assert "Sarathi" in checklist["source_title"]
        assert checklist["verification_date"] == "2026-10-12"
        assert len(checklist["items"]) == 4

        # Since no counters/sessions are active, arrival window should be is_recommended: False
        arrival = plan["arrival_window"]
        assert arrival["is_recommended"] is False
        assert arrival["reason"] is not None

    async def test_get_visit_plan_unverified_service(self, client: httpx.AsyncClient):
        """Verifies unverified service returns truthful has_verified_checklist: False."""
        # 1. Create Location
        loc_resp = await client.post(
            "/api/v1/locations",
            json={
                "name": "Pune General Clinic",
                "category": "hospital",
                "address": "Camp Area, Pune",
                "city": "Pune",
                "state": "Maharashtra",
            },
        )
        assert loc_resp.status_code == 201
        loc_id = loc_resp.json()["id"]

        # 2. Create Service
        svc_resp = await client.post(
            "/api/v1/services",
            json={
                "location_id": loc_id,
                "name": "General Blood Test Phlebotomy",
                "description": "Routine blood draws",
            },
        )
        assert svc_resp.status_code == 201
        svc_id = svc_resp.json()["id"]

        # 3. Call visit-plan endpoint
        plan_resp = await client.get(f"/api/v1/services/{svc_id}/visit-plan")
        assert plan_resp.status_code == 200
        plan = plan_resp.json()

        assert plan["document_checklist"]["has_verified_checklist"] is False
        assert len(plan["document_checklist"]["items"]) == 0
        assert "not yet available" in plan["document_checklist"]["disclaimer"]
