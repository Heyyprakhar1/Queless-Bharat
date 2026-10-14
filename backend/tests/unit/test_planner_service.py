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
    assert checklist.verification_status == "VERIFIED"
    assert "Sarathi Parivahan" in (checklist.source_title or "")
    assert checklist.source_url == "https://sarathi.parivahan.gov.in/"
    assert checklist.verification_date == "2026-10-12"
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
    assert checklist.verification_status == "VERIFIED"
    assert "UIDAI" in (checklist.source_title or "")
    assert "uidai.gov.in" in (checklist.source_url or "")
    assert checklist.verification_date == "2026-10-12"
    assert len(checklist.items) == 3

    item_map = {item.id: item for item in checklist.items}
    assert "poi_original" in item_map
    assert item_map["poi_original"].requirement_type == "ORIGINAL_ONLY"
    assert "poa_original" in item_map
    assert item_map["poa_original"].requirement_type == "ORIGINAL_ONLY"


def test_checklist_resolution_learner_and_permanent_licence():
    """Verifies statutory MoRTH Sarathi checklists for Learner and Permanent DL
    across priority cities.
    """
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()

    # Learner licence
    ll_checklist = planner._resolve_document_checklist(
        service_id, "Learner's Licence Application & Test"
    )
    assert ll_checklist.has_verified_checklist is True
    assert ll_checklist.verification_status == "VERIFIED"
    assert "sarathi.parivahan.gov.in" in (ll_checklist.source_url or "")
    assert ll_checklist.verification_date == "2026-10-12"
    ll_map = {item.id: item for item in ll_checklist.items}
    assert "ll_form2_ack" in ll_map
    assert ll_map["ll_form2_ack"].requirement_type == "PHOTOCOPY_ONLY"
    assert "ll_parent_consent" in ll_map
    assert ll_map["ll_parent_consent"].is_conditional is True
    assert "applicants aged 16–18" in (ll_map["ll_parent_consent"].condition_description or "")

    # Permanent licence
    pdl_checklist = planner._resolve_document_checklist(
        service_id, "Permanent Driving Licence Driving Test Track"
    )
    assert pdl_checklist.has_verified_checklist is True
    assert pdl_checklist.verification_status == "VERIFIED"
    pdl_map = {item.id: item for item in pdl_checklist.items}
    assert "pdl_valid_ll" in pdl_map
    assert pdl_map["pdl_valid_ll"].requirement_type == "ORIGINAL_ONLY"
    assert "pdl_driving_school_form5" in pdl_map
    assert pdl_map["pdl_driving_school_form5"].is_conditional is True


def test_checklist_resolution_vehicle_registration_and_idp():
    """Verifies Vahan vehicle transfer and Sarathi IDP checklists."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()

    # Vahan vehicle registration / transfer
    vahan_checklist = planner._resolve_document_checklist(
        service_id, "Vehicle Registration & Ownership Transfer"
    )
    assert vahan_checklist.has_verified_checklist is True
    assert vahan_checklist.verification_status == "VERIFIED"
    assert "vahan.parivahan.gov.in" in (vahan_checklist.source_url or "")
    vahan_map = {item.id: item for item in vahan_checklist.items}
    assert "vrt_rc_original" in vahan_map
    assert vahan_map["vrt_rc_original"].requirement_type == "ORIGINAL_ONLY"
    assert "vrt_form_29" in vahan_map
    assert vahan_map["vrt_form_29"].requirement_type == "BOTH_ORIGINAL_AND_PHOTOCOPY"
    assert "vrt_form_35_hypothecation" in vahan_map
    assert vahan_map["vrt_form_35_hypothecation"].is_conditional is True

    # IDP
    idp_checklist = planner._resolve_document_checklist(
        service_id, "International Driving Permit (IDP) Verification"
    )
    assert idp_checklist.has_verified_checklist is True
    assert idp_checklist.verification_status == "VERIFIED"
    idp_map = {item.id: item for item in idp_checklist.items}
    assert "idp_passport_visa" in idp_map
    assert idp_map["idp_passport_visa"].requirement_type == "BOTH_ORIGINAL_AND_PHOTOCOPY"


def test_checklist_resolution_radiology_pcpndt():
    """Verifies statutory MoHFW/PCPNDT Act Form F checklist for Ultrasound and Radiology."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    radiology_checklist = planner._resolve_document_checklist(
        service_id, "Radiology & Ultrasound Registration"
    )

    assert radiology_checklist.has_verified_checklist is True
    assert radiology_checklist.verification_status == "VERIFIED"
    assert "mohfw.gov.in" in (radiology_checklist.source_url or "")
    assert radiology_checklist.verification_date == "2026-10-12"
    rad_map = {item.id: item for item in radiology_checklist.items}
    assert "pcpndt_prescription" in rad_map
    assert rad_map["pcpndt_prescription"].requirement_type == "ORIGINAL_ONLY"
    assert "pcpndt_form_f" in rad_map
    assert "PCPNDT Act" in rad_map["pcpndt_form_f"].description


def test_checklist_resolution_birth_and_death_pune():
    """Verifies Pune Birth & Death Certificate checklist retains PMC."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()

    # Explicit city="Pune"
    checklist_pune = planner._resolve_document_checklist(
        service_id, "Birth & Death Certificate Desk", city="Pune"
    )
    assert checklist_pune.has_verified_checklist is True
    assert checklist_pune.verification_status == "VERIFIED"
    assert "Pune Municipal Corporation" in (checklist_pune.source_title or "")
    assert checklist_pune.source_url == "https://pmc.gov.in/"
    assert checklist_pune.verification_date == "2026-10-12"
    assert len(checklist_pune.items) >= 3

    # Default city=None backward-compatibility retains PMC baseline
    checklist_default = planner._resolve_document_checklist(
        service_id, "Birth & Death Certificate Desk", city=None
    )
    assert checklist_default.has_verified_checklist is True
    assert checklist_default.verification_status == "VERIFIED"
    assert "Pune Municipal Corporation" in (checklist_default.source_title or "")
    assert checklist_default.source_url == "https://pmc.gov.in/"


def test_checklist_resolution_birth_and_death_patna():
    """Verifies Patna Birth & Death Certificate resolves to PMC without fabricating URLs."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()

    checklist_patna = planner._resolve_document_checklist(
        service_id, "Birth & Death Certificate Desk", city="Patna"
    )
    assert checklist_patna.has_verified_checklist is True
    assert checklist_patna.verification_status == "PARTIALLY_VERIFIED"
    assert "Patna Municipal Corporation" in (checklist_patna.source_title or "")
    assert "Registration of Births and Deaths Act 1969" in (checklist_patna.source_title or "")
    assert checklist_patna.source_url is None  # Truthful: no unverified URL fabricated
    assert len(checklist_patna.items) >= 3


def test_checklist_resolution_partially_verified_services():
    """Verifies PARTIALLY_VERIFIED status for services with statutory basis but
    municipal/hospital variations.
    """
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()

    # Hospital OPD
    opd_checklist = planner._resolve_document_checklist(
        service_id, "OPD General Medicine Registration"
    )
    assert opd_checklist.has_verified_checklist is True
    assert opd_checklist.verification_status == "PARTIALLY_VERIFIED"
    assert "ors.gov.in" in (opd_checklist.source_url or "")
    opd_map = {item.id: item for item in opd_checklist.items}
    assert "opd_abha_id" in opd_map
    assert "opd_referral" in opd_map
    assert opd_map["opd_referral"].is_conditional is True

    # Property Tax
    pt_checklist = planner._resolve_document_checklist(
        service_id, "Property Tax Assessment & Payment"
    )
    assert pt_checklist.has_verified_checklist is True
    assert pt_checklist.verification_status == "PARTIALLY_VERIFIED"
    pt_map = {item.id: item for item in pt_checklist.items}
    assert "pt_bill_receipt" in pt_map
    assert "pt_khata_extract" in pt_map
    assert pt_map["pt_khata_extract"].is_conditional is True

    # Pathology Blood Sampling
    path_checklist = planner._resolve_document_checklist(
        service_id, "Pathology & Blood Sample Collection"
    )
    assert path_checklist.has_verified_checklist is True
    assert path_checklist.verification_status == "PARTIALLY_VERIFIED"


def test_checklist_resolution_unverified_service():
    """Verifies truthful unverified state when official checklist is not cataloged or
    for demo services.
    """
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()

    # General uncataloged service
    checklist = planner._resolve_document_checklist(service_id, "General Hospital OPD Consultation")
    assert checklist.has_verified_checklist is False
    assert checklist.verification_status == "UNVERIFIED"
    assert checklist.source_title is None
    assert checklist.source_url is None
    assert checklist.verification_date is None
    assert len(checklist.items) == 0
    assert "not yet available" in checklist.disclaimer

    # College demo services (Fergusson College, Gujarat University)
    college_service = planner._resolve_document_checklist(
        service_id, "Degree Certificate Issuance Counter"
    )
    assert college_service.has_verified_checklist is False
    assert college_service.verification_status == "UNVERIFIED"


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


def test_arrival_window_freshness_exact_1800_boundary():
    """Verifies telemetry at exactly 1800 seconds (30m boundary) is accepted as fresh."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        lower_minutes=10.0,
        upper_minutes=20.0,
        expected_minutes=15.0,
        active_counters=3,
        people_ahead=8,
        freshness_seconds=1800,  # Exact 30-minute freshness boundary
    )

    fixed_now = datetime(2026, 10, 13, 12, 0, 0, tzinfo=UTC)
    recommendation = planner._calculate_arrival_window(mock_status, fixed_now)

    assert recommendation.is_recommended is True
    assert recommendation.confidence == EstimateConfidence.HIGH
    assert recommendation.data_freshness_seconds == 1800
    assert recommendation.last_updated == fixed_now
    assert recommendation.window_start_minutes is not None
    assert recommendation.window_end_minutes is not None
    assert recommendation.window_start_minutes < recommendation.window_end_minutes
    assert recommendation.suggested_arrival_text is not None


def test_arrival_window_stale_exact_1801_boundary():
    """Verifies telemetry at 1801 seconds (>1800 boundary) is rejected as stale."""
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()
    mock_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        lower_minutes=10.0,
        upper_minutes=20.0,
        expected_minutes=15.0,
        active_counters=3,
        people_ahead=8,
        freshness_seconds=1801,  # 1 second past freshness boundary
    )

    fixed_now = datetime(2026, 10, 13, 12, 0, 0, tzinfo=UTC)
    recommendation = planner._calculate_arrival_window(mock_status, fixed_now)

    assert recommendation.is_recommended is False
    assert recommendation.confidence is None
    assert recommendation.data_freshness_seconds == 1801
    assert recommendation.last_updated == fixed_now
    assert (
        recommendation.reason
        == "Current estimate unavailable — latest queue data is stale. Please verify with the facility."
    )
    assert recommendation.window_start_minutes is None
    assert recommendation.window_end_minutes is None
    assert recommendation.suggested_arrival_text is None


def test_arrival_window_stale_data_rejection():
    """Verifies telemetry > 1800 seconds (30m) yields truthful unrecommended state with exact message."""
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
    assert recommendation.confidence is None
    assert (
        recommendation.reason
        == "Current estimate unavailable — latest queue data is stale. Please verify with the facility."
    )
    assert recommendation.window_start_minutes is None
    assert recommendation.window_end_minutes is None
    assert recommendation.suggested_arrival_text is None


def test_arrival_window_fresh_vs_stale_telemetry_contrast():
    """Verifies fresh telemetry preserves numerical arrival window and confidence,
    while stale telemetry suppresses both and provides actionable guidance.
    """
    planner = PlannerService(session=MagicMock())
    service_id = uuid.uuid4()

    # 1. Fresh telemetry at 900s
    fresh_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        lower_minutes=10.0,
        upper_minutes=25.0,
        expected_minutes=15.0,
        active_counters=2,
        people_ahead=5,
        freshness_seconds=900,
    )
    fresh_rec = planner._calculate_arrival_window(fresh_status, datetime.now(UTC))
    assert fresh_rec.is_recommended is True
    assert fresh_rec.confidence == EstimateConfidence.HIGH
    assert fresh_rec.suggested_arrival_text is not None
    assert "Within " in fresh_rec.suggested_arrival_text
    assert len(fresh_rec.assumptions) > 0

    # 2. Stale telemetry at 1805s
    stale_status = _build_mock_queue_status(
        service_id,
        "Driving Licence Renewal",
        is_available=True,
        confidence=EstimateConfidence.HIGH,
        lower_minutes=10.0,
        upper_minutes=25.0,
        expected_minutes=15.0,
        active_counters=2,
        people_ahead=5,
        freshness_seconds=1805,
    )
    stale_rec = planner._calculate_arrival_window(stale_status, datetime.now(UTC))
    assert stale_rec.is_recommended is False
    assert stale_rec.confidence is None
    assert stale_rec.suggested_arrival_text is None
    assert stale_rec.window_start_minutes is None
    assert stale_rec.window_end_minutes is None
    assert (
        stale_rec.reason
        == "Current estimate unavailable — latest queue data is stale. Please verify with the facility."
    )


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

    fixed_now = datetime(2026, 10, 13, 12, 0, 0, tzinfo=UTC)
    recommendation = planner._calculate_arrival_window(mock_status, fixed_now)

    assert recommendation.is_recommended is False
    assert recommendation.data_freshness_seconds is None
    assert recommendation.last_updated == fixed_now
    reason_str = (recommendation.reason or "").lower()
    assert "freshness is unavailable" in reason_str or "stale" in reason_str
    assert recommendation.window_start_minutes is None
    assert recommendation.window_end_minutes is None
    assert recommendation.suggested_arrival_text is None


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


@pytest.mark.asyncio
async def test_get_visit_plan_patna_birth_and_death():
    """Verifies get_visit_plan resolves city-aware authority metadata for Patna civic services."""
    mock_session = AsyncMock()
    service_id = uuid.uuid4()
    mock_location = Location(
        name="Patna Municipal Corporation HQ",
        city="Patna",
        state="Bihar",
        category="Municipal Corporation",
        address="Maurya Lok Complex, Patna",
    )
    mock_service = Service(
        id=service_id,
        location_id=mock_location.id,
        name="Birth & Death Certificate Desk",
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
        lower_minutes=10.0,
        upper_minutes=25.0,
        expected_minutes=18.0,
        active_counters=3,
        freshness_seconds=90,
    )
    planner.estimation_service.get_service_queue_status = AsyncMock(return_value=mock_queue_status)

    plan = await planner.get_visit_plan(service_id)

    assert plan.service_id == service_id
    assert plan.city == "Patna"
    assert plan.document_checklist.has_verified_checklist is True
    assert plan.document_checklist.verification_status == "PARTIALLY_VERIFIED"
    assert "Patna Municipal Corporation" in (plan.document_checklist.source_title or "")
    assert plan.document_checklist.source_url is None


@pytest.mark.asyncio
async def test_get_visit_plan_survives_estimation_service_failure():
    """Verifies queue estimation error degrades arrival window safely without losing checklist."""
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
    # Simulate telemetry / queue computation crash
    planner.estimation_service.get_service_queue_status = AsyncMock(
        side_effect=RuntimeError("Database telemetry connection lost")
    )

    plan = await planner.get_visit_plan(service_id)

    assert plan.service_id == service_id
    assert plan.arrival_window.is_recommended is False
    assert "unavailable" in (plan.arrival_window.reason or "").lower()
    # Verified document checklist is preserved
    assert plan.document_checklist.has_verified_checklist is True
    assert plan.document_checklist.verification_status == "VERIFIED"
    assert len(plan.document_checklist.items) == 4
