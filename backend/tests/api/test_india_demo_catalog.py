"""M6.1 India Demo Facility Coverage and Deterministic Catalog API Tests."""

import uuid

import httpx

from scripts.seed_data import seed


class TestIndiaDemoCatalogAPI:
    """Verifies City -> Facility -> Service -> Queue Status API flow and demo metadata."""

    async def test_city_listing_and_filtering(self, client: httpx.AsyncClient):
        """Verifies distinct city listing and city-based facility filtering."""
        # Create facilities across multiple cities
        loc_pune = await client.post(
            "/api/v1/locations",
            json={
                "name": "Pune Regional Transport Office",
                "category": "rto",
                "address": "38 Dr Ambedkar Road",
                "city": "Pune",
                "state": "Maharashtra",
                "timezone": "Asia/Kolkata",
                "latitude": 18.5293,
                "longitude": 73.8640,
            },
        )
        assert loc_pune.status_code == 201

        loc_mumbai = await client.post(
            "/api/v1/locations",
            json={
                "name": "Mumbai Central RTO",
                "category": "rto",
                "address": "Tardeo Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "timezone": "Asia/Kolkata",
                "latitude": 18.9715,
                "longitude": 72.8164,
            },
        )
        assert loc_mumbai.status_code == 201

        loc_blr = await client.post(
            "/api/v1/locations",
            json={
                "name": "Victoria Hospital Bengaluru",
                "category": "hospital",
                "address": "Fort Road",
                "city": "Bengaluru",
                "state": "Karnataka",
                "timezone": "Asia/Kolkata",
                "latitude": 12.9625,
                "longitude": 77.5753,
            },
        )
        assert loc_blr.status_code == 201

        # 1. Query distinct cities
        cities_resp = await client.get("/api/v1/locations/cities")
        assert cities_resp.status_code == 200
        cities = cities_resp.json()
        assert isinstance(cities, list)
        assert "Bengaluru" in cities
        assert "Mumbai" in cities
        assert "Pune" in cities
        # Verify alphabetical ordering
        assert cities == sorted(cities)

        # 2. Filter locations by city (Pune)
        pune_resp = await client.get("/api/v1/locations?city=Pune")
        assert pune_resp.status_code == 200
        pune_locs = pune_resp.json()
        assert len(pune_locs) == 1
        assert pune_locs[0]["name"] == "Pune Regional Transport Office"
        assert pune_locs[0]["city"] == "Pune"

        # 3. Case-insensitive filter (pune)
        pune_lower_resp = await client.get("/api/v1/locations?city=pune")
        assert pune_lower_resp.status_code == 200
        assert len(pune_lower_resp.json()) == 1

        # 4. Filter by non-existent city returns empty list
        none_resp = await client.get("/api/v1/locations?city=NonExistentCity")
        assert none_resp.status_code == 200
        assert none_resp.json() == []

    async def test_facility_service_filtering(self, client: httpx.AsyncClient):
        """Verifies querying services filtered by facility location_id."""
        loc_resp = await client.post(
            "/api/v1/locations",
            json={
                "name": "Sassoon General Hospital",
                "category": "hospital",
                "address": "Near Pune Railway Station",
                "city": "Pune",
                "state": "Maharashtra",
            },
        )
        assert loc_resp.status_code == 201
        loc_id = loc_resp.json()["id"]

        svc1_resp = await client.post(
            "/api/v1/services",
            json={
                "location_id": loc_id,
                "name": "OPD General Medicine Registration",
                "description": "General consultation queue",
            },
        )
        assert svc1_resp.status_code == 201

        svc2_resp = await client.post(
            "/api/v1/services",
            json={
                "location_id": loc_id,
                "name": "Radiology & Ultrasound Token",
                "description": "Imaging appointment queue",
            },
        )
        assert svc2_resp.status_code == 201

        # Query services for this location
        svcs_resp = await client.get(f"/api/v1/services?location_id={loc_id}")
        assert svcs_resp.status_code == 200
        svcs = svcs_resp.json()
        assert len(svcs) == 2
        svc_names = {s["name"] for s in svcs}
        assert "OPD General Medicine Registration" in svc_names
        assert "Radiology & Ultrasound Token" in svc_names

    async def test_seeded_demo_coverage_and_deterministic_estimates(
        self, client: httpx.AsyncClient
    ):
        """Executes seed script and verifies all 8 target cities and Pune showcase scenarios."""
        await seed()

        # 1. Verify 8 cities plus baseline are present
        cities_resp = await client.get("/api/v1/locations/cities")
        assert cities_resp.status_code == 200
        cities = cities_resp.json()

        expected_cities = [
            "Ahmedabad",
            "Bengaluru",
            "Chandigarh",
            "Chennai",
            "Coimbatore",
            "Delhi",
            "Gurugram",
            "Hyderabad",
            "Indore",
            "Jaipur",
            "Kochi",
            "Kolkata",
            "Lucknow",
            "Mumbai",
            "Nagpur",
            "Noida",
            "Patna",
            "Pune",
            "Surat",
            "Vadodara",
        ]
        for c in expected_cities:
            assert c in cities, f"City {c} missing from cities endpoint"

        # 2. Verify Pune showcase facilities
        pune_resp = await client.get("/api/v1/locations?city=Pune")
        assert pune_resp.status_code == 200
        pune_facilities = pune_resp.json()
        assert len(pune_facilities) == 4
        pune_names = {f["name"] for f in pune_facilities}
        assert "Pune Regional Transport Office (MH-12 RTO)" in pune_names
        assert "Sassoon General Hospital" in pune_names
        assert "Pune Municipal Corporation (PMC Main Building)" in pune_names
        assert "Fergusson College Campus Office" in pune_names

        # 3. Verify Pune RTO scenarios: Driving Licence Renewal (Moderate Queue)
        rto_fac = next(f for f in pune_facilities if "MH-12 RTO" in f["name"])
        rto_svcs_resp = await client.get(f"/api/v1/services?location_id={rto_fac['id']}")
        assert rto_svcs_resp.status_code == 200
        rto_svcs = rto_svcs_resp.json()

        dl_svc = next(s for s in rto_svcs if s["name"] == "Driving Licence Renewal")
        status_resp = await client.get(f"/api/v1/services/{dl_svc['id']}/queue-status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()

        # Check provenance metadata
        assert status_data["is_simulated"] is True
        assert status_data["people_ahead"] == 8
        assert status_data["active_counters"] == 2
        est = status_data["estimated_wait"]
        assert est["is_available"] is True
        assert est["lower_minutes"] is not None
        assert est["upper_minutes"] is not None
        assert est["expected_minutes"] is not None
        assert est["lower_minutes"] <= est["expected_minutes"] <= est["upper_minutes"]
        assert est["confidence"] in ["HIGH", "MEDIUM"]
        assert est["supporting_signals"]["is_simulated"] is True
        assert "DEMO / SIMULATED" in est["supporting_signals"]["simulation_notice"]

        # 4. Verify Sassoon Hospital: Radiology & Ultrasound (Insufficient Data Scenario)
        sassoon_fac = next(f for f in pune_facilities if "Sassoon" in f["name"])
        sassoon_svcs_resp = await client.get(f"/api/v1/services?location_id={sassoon_fac['id']}")
        sassoon_svcs = sassoon_svcs_resp.json()

        radio_svc = next(s for s in sassoon_svcs if "Radiology" in s["name"])
        radio_status_resp = await client.get(f"/api/v1/services/{radio_svc['id']}/queue-status")
        assert radio_status_resp.status_code == 200
        radio_data = radio_status_resp.json()

        assert radio_data["is_simulated"] is True
        assert radio_data["people_ahead"] == 4
        radio_est = radio_data["estimated_wait"]
        assert radio_est["is_available"] is False
        assert radio_est["lower_minutes"] is None
        assert radio_est["upper_minutes"] is None
        assert radio_est["expected_minutes"] is None
        assert "Insufficient sample data" in radio_est["reason"]

        # 5. Verify Pune Municipal Corporation: Closed Counter Scenario
        pmc_fac = next(f for f in pune_facilities if "PMC" in f["name"])
        pmc_svcs_resp = await client.get(f"/api/v1/services?location_id={pmc_fac['id']}")
        pmc_svcs = pmc_svcs_resp.json()

        bd_svc = next(s for s in pmc_svcs if "Birth & Death" in s["name"])
        bd_status_resp = await client.get(f"/api/v1/services/{bd_svc['id']}/queue-status")
        assert bd_status_resp.status_code == 200
        bd_data = bd_status_resp.json()

        assert bd_data["is_simulated"] is True
        assert bd_data["active_counters"] == 0
        assert bd_data["estimated_wait"]["is_available"] is False
        assert "No active counters" in bd_data["estimated_wait"]["reason"]

    async def test_invalid_ids_404_behavior(self, client: httpx.AsyncClient):
        """Verifies proper 404 ResourceNotFoundError behavior on invalid IDs."""
        non_existent_loc_id = uuid.uuid4()
        loc_resp = await client.get(f"/api/v1/locations/{non_existent_loc_id}")
        assert loc_resp.status_code == 404
        assert "not found" in loc_resp.json()["detail"].lower()

        non_existent_svc_id = uuid.uuid4()
        svc_resp = await client.get(f"/api/v1/services/{non_existent_svc_id}")
        assert svc_resp.status_code == 404
        assert "not found" in svc_resp.json()["detail"].lower()

        q_resp = await client.get(f"/api/v1/services/{non_existent_svc_id}/queue-status")
        assert q_resp.status_code == 404
        assert "not found" in q_resp.json()["detail"].lower()
