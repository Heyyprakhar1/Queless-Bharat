"""Smart Visit Planner schemas for arrival window and document readiness."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import EstimateConfidence


class DocumentChecklistItem(BaseModel):
    """An individual required or recommended document item."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(..., description="Unique machine-readable identifier for the document item")
    name: str = Field(..., description="Official document name")
    description: str = Field(..., description="Concise explanation of document purpose")
    requirement_type: str = Field(
        ...,
        description=(
            "Requirement specification: ORIGINAL_ONLY, PHOTOCOPY_ONLY, "
            "or BOTH_ORIGINAL_AND_PHOTOCOPY"
        ),
    )
    is_mandatory: bool = Field(default=True, description="Whether document is strictly required")
    is_conditional: bool = Field(
        default=False,
        description="Whether document requirement depends on applicant circumstances",
    )
    condition_description: str | None = Field(
        default=None, description="Circumstances under which this document is required"
    )
    notes: str | None = Field(
        default=None, description="Additional verified instructions or caveats"
    )


class DocumentChecklist(BaseModel):
    """Service-specific document readiness checklist with authoritative source metadata."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_id: uuid.UUID
    service_name: str
    verification_status: str = Field(
        default="UNVERIFIED",
        description="Verification level: VERIFIED, PARTIALLY_VERIFIED, or UNVERIFIED",
    )
    has_verified_checklist: bool = Field(
        ..., description="True if requirements are backed by an official government source"
    )
    source_title: str | None = Field(
        default=None, description="Official government authority or portal name"
    )
    source_url: str | None = Field(
        default=None, description="Official URL for public requirement verification"
    )
    verification_date: str | None = Field(
        default=None, description="Date on which requirements were last verified (YYYY-MM-DD)"
    )
    disclaimer: str = Field(
        default="Completing this checklist does not guarantee approval or service.",
        description="Mandatory legal/operational disclaimer",
    )
    items: list[DocumentChecklistItem] = Field(
        default_factory=list, description="Verified checklist items"
    )


class ArrivalWindowRecommendation(BaseModel):
    """Deterministic arrival window recommendation bounded by empirical queue throughput."""

    model_config = ConfigDict(str_strip_whitespace=True)

    is_recommended: bool = Field(
        ...,
        description="Whether a meaningful arrival window can be recommended based on fresh data",
    )
    confidence: EstimateConfidence | None = Field(
        default=None, description="Mathematical confidence score (HIGH, MEDIUM, LOW)"
    )
    window_start_minutes: int | None = Field(
        default=None, description="Relative arrival window start from now (minutes)"
    )
    window_end_minutes: int | None = Field(
        default=None, description="Relative arrival window end from now (minutes)"
    )
    suggested_arrival_text: str | None = Field(
        default=None, description="Human-readable arrival window (e.g. 'Within 15–30 minutes')"
    )
    data_freshness_seconds: int | None = Field(
        default=None, description="Age of most recent observation or completed session"
    )
    last_updated: datetime | None = Field(
        default=None, description="Timestamp of telemetry used for this projection"
    )
    reason: str | None = Field(
        default=None, description="Explanation when recommendation is unavailable or insufficient"
    )
    assumptions: list[str] = Field(
        default_factory=list, description="Key assumptions underlying the projection"
    )
    disclaimer: str = Field(
        default=(
            "This arrival window is a statistical projection based on recent counter throughput, "
            "NOT an appointment or guarantee of service. Arrival within this window does not "
            "guarantee shorter waiting times."
        ),
        description="Mandatory disclaimer distinguishing estimate from guarantee",
    )


class VisitPlanResponse(BaseModel):
    """Consolidated Smart Visit Plan response."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_id: uuid.UUID
    service_name: str
    location_name: str
    city: str
    arrival_window: ArrivalWindowRecommendation
    document_checklist: DocumentChecklist
    is_simulated: bool = Field(
        default=True,
        description="Indicates whether underlying queue metrics are demo/simulated data",
    )
