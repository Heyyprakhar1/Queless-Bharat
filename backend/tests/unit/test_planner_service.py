"""Unit tests for Smart Visit Planner business logic and deterministic arrival window."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.domain.enums import EstimateConfidence
from app.domain.exceptions import ResourceNotFoundError
from app.domain.models import Location, Service
from app.schemas.queue import QueueStateSummary, QueueStatusResponse, WaitEstimatePayload
from app.schemas.service import ServiceResponse
from app.services.planner_service import PlannerService


def _build_mock_queue_status(
    service_id: uuid.UUID,
    service_name: str,
    is_available: bool = True,
    confidence: EstimateConfidence = EstimateConfidence.HIGH,
    lower_minutes: float = 12.0,
    upper_minutes: float = 24.0,
    expected_minutes: float = 18.0,
    active_counters: int = 3,
    people_ahead: int = 10,
    freshness_seconds: int = 120,
    reason: str | None = None,
) -> QueueStatusResponse:
    now = datetime.now(UTC)
    service_resp = ServiceResponse(
        id=service_id,
        location_id=uuid.uuid4(),
        name=service_name,
        description="Test service",
        status="ACTIVE",
        created_at=now,
        updated_at=now,
    )
    est_payload = WaitEstimatePayload(
        is_available=is_available,
        lower_minutes=lower_minutes if is_available else None,
        upper_minutes=upper_minutes if is_available else None,
        expected_minutes=expected_minutes if is_available else None,
        confidence=confidence if is_available else None,
        sample_size=15,
        freshness_seconds=freshness_seconds,
        reason=reason,
        supporting_signals={"avg_service_time_minutes": 5.4},
    )
    return QueueStatusResponse(
        service=service_resp,
        queue_state=QueueStateSummary(
            waiting_count=people_ahead,
            in_service_count=2,
            active_counters=active_counters,
        ),
        people_ahead=people_ahead,
        active_counters=active_counters,
        estimated_wait=est_payload,
        is_simulated=True,
    )


def test_checklist_resolution_dl_renewal():
    """Verifies authoritative MoRTH/Sarathi checklist resolution for DL renewal."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    checklist = planner._resolve_document_checklist(
        service_id, "Driving Licence Renewal & Biometrics"
    )

    assert checklist.has_verified_checklist is True
    assert "Sarathi Parivahan" in (checklist.source_title or "")
    assert checklist.source_url == "https://sarathi.parivahan.gov.in/"
    assert checklist.verification_date == "2026-10-01"
    assert "does not guarantee" in checklist.disclaimer
    assert len(checklist.items) == 4

    item_map = {item.id: item for item in checklist.items}
    assert "dl_original" in item_map
    assert item_map["dl_original"].requirement_type == "ORIGINAL_ONLY"
    assert "proof_identity_address" in item_map
    assert item_map["proof_identity_address"].requirement_type == "BOTH_ORIGINAL_AND_PHOTOCOPY"
    assert "sarathi_form_9" in item_map
    assert item_map["sarathi_form_9"].requirement_type == "PHOTOCOPY_ONLY"


def test_checklist_resolution_aadhaar_update():
    """Verifies authoritative UIDAI checklist resolution for Aadhaar update."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    checklist = planner._resolve_document_checklist(
        service_id, "Citizen Aadhaar & Identity Update Desk"
    )

    assert checklist.has_verified_checklist is True
    assert "UIDAI" in (checklist.source_title or "")
    assert "uidai.gov.in" in (checklist.source_url or "")
    assert checklist.verification_date == "2026-10-01"
    assert len(checklist.items) == 3

    item_map = {item.id: item for item in checklist.items}
    assert "poi_original" in item_map
    assert item_map["poi_original"].requirement_type == "ORIGINAL_ONLY"
    assert "poa_original" in item_map
    assert item_map["poa_original"].requirement_type == "ORIGINAL_ONLY"


def test_checklist_resolution_unverified_service():
    """Verifies truthful unverified state when official checklist is not yet cataloged."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    checklist = planner._resolve_document_checklist(service_id, "General Hospital OPD Consultation")

    assert checklist.has_verified_checklist is False
    assert checklist.source_title is None
    assert checklist.source_url is None
    assert checklist.verification_date is None
    assert len(checklist.items) == 0
    assert "not yet available" in checklist.disclaimer


def test_arrival_window_sufficient_data_recommendation():
    """Verifies valid arrival window recommendation when fresh, high-confidence data exists."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        lower_minutes=14.0,
        upper_minutes=26.0,
        expected_minutes=20.0,
        active_counters=3,
        freshness_seconds=180,
    )

    now = datetime.now(UTC)
    recommendation = planner._calculate_arrival_window(mock_status, now)

    assert recommendation.is_recommended is True
    assert recommendation.confidence == EstimateConfidence.HIGH
    assert recommendation.window_start_minutes is not None
    assert recommendation.window_end_minutes is not None
    assert recommendation.window_start_minutes < recommendation.window_end_minutes
    assert "Within" in (recommendation.suggested_arrival_text or "")
    assert len(recommendation.assumptions) >= 3
    assert "NOT an appointment or guarantee" in recommendation.disclaimer


def test_arrival_window_deterministic_reproducibility():
    """Verifies identical inputs yield byte-for-byte identical arrival window outputs."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Aadhaar Update Desk",
        is_available=True,
        confidence=EstimateConfidence.MEDIUM,
        lower_minutes=8.0,
        upper_minutes=18.0,
        expected_minutes=12.0,
        active_counters=2,
        freshness_seconds=300,
    )

    now = datetime(2026, 10, 12, 12, 0, 0, tzinfo=UTC)
    res1 = planner._calculate_arrival_window(mock_status, now)
    res2 = planner._calculate_arrival_window(mock_status, now)

    assert res1.is_recommended == res2.is_recommended
    assert res1.window_start_minutes == res2.window_start_minutes
    assert res1.window_end_minutes == res2.window_end_minutes
    assert res1.suggested_arrival_text == res2.suggested_arrival_text
    assert res1.assumptions == res2.assumptions


def test_arrival_window_stale_data_rejection():
    """Verifies telemetry > 1800 seconds (30m) yields truthful unrecommended state."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        freshness_seconds=2400,  # 40 minutes old (stale)
    )

    recommendation = planner._calculate_arrival_window(mock_status, datetime.now(UTC))

    assert recommendation.is_recommended is False
    assert "stale" in (recommendation.reason or "").lower()
    assert recommendation.window_start_minutes is None
    assert recommendation.window_end_minutes is None


def test_arrival_window_low_confidence_rejection():
    """Verifies LOW confidence prevents misleading arrival window recommendation."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.LOW,
        freshness_seconds=120,
    )

    recommendation = planner._calculate_arrival_window(mock_status, datetime.now(UTC))

    assert recommendation.is_recommended is False
    assert "variance" in (recommendation.reason or "").lower()


def test_arrival_window_zero_active_counters_rejection():
    """Verifies zero active counters rejects arrival window recommendation."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=False,
        active_counters=0,
        reason="No active counters available",
    )

    recommendation = planner._calculate_arrival_window(mock_status, datetime.now(UTC))

    assert recommendation.is_recommended is False
    assert recommendation.window_start_minutes is None


def test_arrival_window_missing_freshness_rejection():
    """Verifies missing freshness timestamp (None) rejects recommendation truthfully."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        freshness_seconds=None,  # type: ignore[arg-type]
    )

    recommendation = planner._calculate_arrival_window(mock_status, datetime.now(UTC))

    assert recommendation.is_recommended is False
    reason_str = (recommendation.reason or "").lower()
    assert "freshness is unavailable" in reason_str or "stale" in reason_str
    assert recommendation.window_start_minutes is None


def test_arrival_window_empty_queue_near_zero_wait():
    """Verifies empty queue (0 people waiting) produces valid low-congestion arrival window."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        lower_minutes=0.0,
        upper_minutes=0.0,
        expected_minutes=0.0,
        active_counters=3,
        people_ahead=0,
        freshness_seconds=30,
    )

    recommendation = planner._calculate_arrival_window(mock_status, datetime.now(UTC))

    assert recommendation.is_recommended is True
    assert recommendation.window_start_minutes == 5
    assert recommendation.window_end_minutes == 15
    assert recommendation.suggested_arrival_text == "Within 5–15 minutes"


def test_arrival_window_high_congestion_wide_buffer():
    """Verifies high wait (>45 min) calculates appropriate wider planning buffer."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        lower_minutes=40.0,
        upper_minutes=80.0,
        expected_minutes=60.0,
        active_counters=2,
        people_ahead=35,
        freshness_seconds=120,
    )

    recommendation = planner._calculate_arrival_window(mock_status, datetime.now(UTC))

    assert recommendation.is_recommended is True
    assert recommendation.window_start_minutes >= 15
    assert recommendation.window_end_minutes > recommendation.window_start_minutes
    assert recommendation.suggested_arrival_text is not None


def test_checklist_resolution_no_false_positive_for_trade_licence():
    """Verifies Trade Licence does NOT falsely trigger Driving Licence checklist."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    checklist = planner._resolve_document_checklist(
        service_id, "Trade Licence & Commercial Property Tax"
    )

    assert checklist.has_verified_checklist is False
    assert len(checklist.items) == 0


@pytest.mark.asyncio
async def test_get_visit_plan_not_found():
    """Verifies ResourceNotFoundError when querying non-existent service ID."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    planner = PlannerService(mock_session)
    with pytest.raises(ResourceNotFoundError):
        await planner.get_visit_plan(uuid.uuid4())


@pytest.mark.asyncio
async def test_get_visit_plan_success():
    """Verifies end-to-end get_visit_plan assembly with service, location, window, and checklist."""
    mock_session = AsyncMock()
    service_id = uuid.uuid4()
    mock_location = Location(
        name="Pune Regional Transport Office",
        city="Pune",
        state="Maharashtra",
        category="RTO",
        address="Alandi Road",
    )
    mock_service = Service(
        id=service_id,
        location_id=mock_location.id,
        name="Driving Licence Renewal & Biometrics",
        status="ACTIVE",
    )
    mock_service.location = mock_location

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_service
    mock_session.execute.return_value = mock_result

    planner = PlannerService(mock_session)
    mock_queue_status = _build_mock_queue_status(
        service_id,
        mock_service.name,
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        lower_minutes=15.0,
        upper_minutes=30.0,
        expected_minutes=22.0,
        active_counters=4,
        freshness_seconds=60,
    )
    planner.estimation_service.get_service_queue_status = AsyncMock(return_value=mock_queue_status)

    plan = await planner.get_visit_plan(service_id)

    assert plan.service_id == service_id
    assert plan.service_name == "Driving Licence Renewal & Biometrics"
    assert plan.location_name == "Pune Regional Transport Office"
    assert plan.city == "Pune"
    assert plan.arrival_window.is_recommended is True
    assert plan.document_checklist.has_verified_checklist is True
    assert len(plan.document_checklist.items) == 4
