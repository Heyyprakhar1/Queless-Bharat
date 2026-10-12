"""Smart Visit Planner service orchestrating arrival window recommendations and checklists."""

import math
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.enums import EstimateConfidence
from app.domain.exceptions import ResourceNotFoundError
from app.domain.models import Service
from app.schemas.planner import (
    ArrivalWindowRecommendation,
    DocumentChecklist,
    DocumentChecklistItem,
    VisitPlanResponse,
)
from app.services.estimation_service import EstimationService

# Authoritative government verified document checklists
_VERIFIED_CHECKLIST_CATALOG: dict[str, dict] = {
    "driving_licence_renewal": {
        "match_substrings": [
            "driving licence renewal",
            "licence renewal",
            "driving license renewal",
        ],
        "source_title": "Ministry of Road Transport and Highways (MoRTH) / Sarathi Parivahan",
        "source_url": "https://parivahan.gov.in/parivahan//en/content/driving-licence-0",
        "verification_date": "2026-10-01",
        "items": [
            DocumentChecklistItem(
                id="dl_original",
                name="Original Driving Licence",
                description=(
                    "Physical licence card to be inspected and surrendered for new smart card "
                    "issuance."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                notes=(
                    "If lost or stolen, an official police report (NC) and Form LLD are required."
                ),
            ),
            DocumentChecklistItem(
                id="medical_form_1a",
                name="Medical Certificate (Form 1-A)",
                description=(
                    "Official medical fitness certificate signed and sealed by a registered "
                    "medical practitioner."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                notes=(
                    "Mandatory for commercial vehicle licence holders and applicants aged 40 "
                    "years or older."
                ),
            ),
            DocumentChecklistItem(
                id="proof_identity_address",
                name="Proof of Age & Address",
                description=(
                    "Valid government-issued photo identity and address document (Aadhaar, "
                    "Voter ID, or Passport)."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                notes=(
                    "Present physical original for in-person visual inspection plus a signed "
                    "self-attested copy."
                ),
            ),
            DocumentChecklistItem(
                id="sarathi_form_9",
                name="Sarathi Online Application Acknowledgement (Form 9)",
                description=(
                    "Printed confirmation slip or application reference receipt from the Sarathi "
                    "Parivahan portal."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                notes="Must clearly display your Application Number and verified payment status.",
            ),
        ],
    },
    "aadhaar_identity_update": {
        "match_substrings": ["aadhaar", "identity update", "identity modification"],
        "source_title": "Unique Identification Authority of India (UIDAI)",
        "source_url": (
            "https://uidai.gov.in/en/my-aadhaar/about-your-aadhaar/updating-data-on-aadhaar.html"
        ),
        "verification_date": "2026-10-01",
        "items": [
            DocumentChecklistItem(
                id="poi_original",
                name="Proof of Identity (POI)",
                description=(
                    "Valid document containing applicant's full name and photograph (Passport, "
                    "PAN Card, Voter ID, or Driving Licence)."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                notes=(
                    "Per UIDAI regulatory standards, physical original document must be produced "
                    "for live optical scanning. Photocopies are strictly not accepted."
                ),
            ),
            DocumentChecklistItem(
                id="poa_original",
                name="Proof of Address (POA)",
                description=(
                    "Valid residential address proof (Electricity/Water bill within 3 months, "
                    "Bank Passbook with photograph, or Passport)."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                notes=(
                    "Physical original document must be presented for real-time document capture "
                    "at the update window."
                ),
            ),
            DocumentChecklistItem(
                id="aadhaar_slip",
                name="Existing Aadhaar Number / Enrolment Slip",
                description=(
                    "Physical Aadhaar letter, plastic PVC card, or printed e-Aadhaar displaying "
                    "12-digit UID."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                notes=(
                    "Citizen physical presence is mandatory for biometric verification "
                    "(fingerprint/iris/photo)."
                ),
            ),
        ],
    },
}


class PlannerService:
    """Business logic for deterministic visit planning and verified document checklists."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.estimation_service = EstimationService(session)

    def _resolve_document_checklist(
        self, service_id: uuid.UUID, service_name: str
    ) -> DocumentChecklist:
        """Resolves authoritative document checklist for the given service."""
        lower_name = service_name.lower().strip()

        matched_spec = None
        for _, spec in _VERIFIED_CHECKLIST_CATALOG.items():
            if any(substring in lower_name for substring in spec["match_substrings"]):
                matched_spec = spec
                break

        if matched_spec:
            return DocumentChecklist(
                service_id=service_id,
                service_name=service_name,
                has_verified_checklist=True,
                source_title=matched_spec["source_title"],
                source_url=matched_spec["source_url"],
                verification_date=matched_spec["verification_date"],
                disclaimer="Completing this checklist does not guarantee approval or service.",
                items=matched_spec["items"],
            )

        # Unverified service
        return DocumentChecklist(
            service_id=service_id,
            service_name=service_name,
            has_verified_checklist=False,
            source_title=None,
            source_url=None,
            verification_date=None,
            disclaimer=(
                "Official verified checklist is not yet available for this service. "
                "Please verify requirements directly with the facility."
            ),
            items=[],
        )

    def _calculate_arrival_window(
        self,
        queue_status,
        now: datetime,
    ) -> ArrivalWindowRecommendation:
        """Calculates a deterministic arrival window recommendation from current queue metrics."""
        est = queue_status.estimated_wait
        active_counters = queue_status.active_counters
        freshness_sec = est.freshness_seconds

        # 1. Check if wait estimate is unavailable
        if not est.is_available:
            return ArrivalWindowRecommendation(
                is_recommended=False,
                confidence=est.confidence,
                data_freshness_seconds=freshness_sec,
                last_updated=now,
                reason=est.reason or "Queue estimation is currently unavailable.",
            )

        # 2. Check for halted queue / zero active counters
        if active_counters <= 0:
            return ArrivalWindowRecommendation(
                is_recommended=False,
                confidence=est.confidence,
                data_freshness_seconds=freshness_sec,
                last_updated=now,
                reason="All service counters are currently closed or halted.",
            )

        # 3. Check for stale data (> 1800 seconds / 30 minutes)
        if freshness_sec is not None and freshness_sec > 1800:
            return ArrivalWindowRecommendation(
                is_recommended=False,
                confidence=est.confidence,
                data_freshness_seconds=freshness_sec,
                last_updated=now,
                reason=(
                    "Queue telemetry is stale (>30 minutes old). "
                    "An arrival window cannot be reliably projected."
                ),
            )

        # 4. Check for low confidence or sparse data
        if est.confidence == EstimateConfidence.LOW:
            return ArrivalWindowRecommendation(
                is_recommended=False,
                confidence=EstimateConfidence.LOW,
                data_freshness_seconds=freshness_sec,
                last_updated=now,
                reason=(
                    "Throughput variance is currently high or sample baseline is small. "
                    "Arrival window cannot be reliably projected."
                ),
            )

        # 5. Deterministic calculation with sufficient, fresh data
        lower_wait = est.lower_minutes if est.lower_minutes is not None else 0.0
        upper_wait = est.upper_minutes if est.upper_minutes is not None else 0.0
        expected_wait = est.expected_minutes if est.expected_minutes is not None else 0.0

        if expected_wait <= 10.0:
            # Short wait: recommend arriving soon to take advantage of low congestion
            window_start = 5
            window_end = max(15, int(math.ceil(upper_wait + 5)))
        elif expected_wait <= 45.0:
            # Moderate wait: recommend window buffered by lower bound
            window_start = max(10, int(math.floor(lower_wait * 0.5)))
            window_end = max(window_start + 15, int(math.ceil(upper_wait * 0.9)))
        else:
            # Long wait: wider buffer
            window_start = max(15, int(math.floor(lower_wait * 0.6)))
            window_end = max(window_start + 20, int(math.ceil(upper_wait * 0.85)))

        avg_duration = est.supporting_signals.get("avg_service_time_minutes", 5.0)

        assumptions = [
            f"Assumes active counter count ({active_counters} open desks) remains consistent.",
            f"Based on recent empirical service throughput (~{avg_duration} minutes per citizen).",
            "Assumes steady queue clearance without unforeseen high-priority emergency cases.",
            "Subject to facility operating hours and scheduled staff lunch/tea breaks.",
        ]

        return ArrivalWindowRecommendation(
            is_recommended=True,
            confidence=est.confidence,
            window_start_minutes=window_start,
            window_end_minutes=window_end,
            suggested_arrival_text=f"Within {window_start}–{window_end} minutes",
            data_freshness_seconds=freshness_sec,
            last_updated=now,
            assumptions=assumptions,
            reason=None,
        )

    async def get_visit_plan(self, service_id: uuid.UUID) -> VisitPlanResponse:
        """Retrieves or calculates the Smart Visit Plan for a given service."""
        # 1. Fetch service with location details
        stmt = (
            select(Service).options(selectinload(Service.location)).where(Service.id == service_id)
        )
        service = (await self.session.execute(stmt)).scalar_one_or_none()
        if not service:
            raise ResourceNotFoundError("Service", str(service_id))

        now = datetime.now(UTC)

        # 2. Query deterministic queue status from EstimationService
        queue_status = await self.estimation_service.get_service_queue_status(
            service_id=service_id, persist_estimate=False
        )

        # 3. Derive deterministic arrival window recommendation
        arrival_window = self._calculate_arrival_window(queue_status, now)

        # 4. Resolve verified document checklist
        document_checklist = self._resolve_document_checklist(service.id, service.name)

        location_name = service.location.name if service.location else "Unknown Location"
        city = service.location.city if service.location else "Unknown City"

        return VisitPlanResponse(
            service_id=service.id,
            service_name=service.name,
            location_name=location_name,
            city=city,
            arrival_window=arrival_window,
            document_checklist=document_checklist,
            is_simulated=queue_status.is_simulated,
        )
