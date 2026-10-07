"""Estimation orchestration service integrating DB state with deterministic queue engine."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import CounterStatus, QueueSessionStatus
from app.domain.exceptions import ResourceNotFoundError
from app.domain.models import (
    Counter,
    Estimate,
    QueueSession,
    Service,
    ServiceSession,
    WaitObservation,
)
from app.engine.estimator import (
    DeterministicQueueEstimator,
    EstimatorInput,
    WaitEstimate,
)
from app.schemas.queue import (
    QueueStateSummary,
    QueueStatusResponse,
    WaitEstimatePayload,
)
from app.schemas.service import ServiceResponse


class EstimationService:
    """Orchestrates DB signal retrieval, deterministic estimation, and estimate persistence."""

    def __init__(
        self,
        session: AsyncSession,
        estimator: DeterministicQueueEstimator | None = None,
    ) -> None:
        self.session = session
        self.estimator = estimator or DeterministicQueueEstimator()

    async def get_service_queue_status(
        self,
        service_id: uuid.UUID,
        persist_estimate: bool = True,
    ) -> QueueStatusResponse:
        """Computes current queue status and deterministic wait estimation for a service."""
        # 1. Verify service exists
        svc_stmt = select(Service).where(Service.id == service_id)
        service = (await self.session.execute(svc_stmt)).scalar_one_or_none()
        if not service:
            raise ResourceNotFoundError("Service", str(service_id))

        now = datetime.now(UTC)

        # 2. Count waiting and in-service participants
        waiting_stmt = (
            select(func.count())
            .select_from(QueueSession)
            .where(
                QueueSession.service_id == service_id,
                QueueSession.status == QueueSessionStatus.WAITING,
            )
        )
        waiting_count = (await self.session.execute(waiting_stmt)).scalar() or 0

        in_service_stmt = (
            select(func.count())
            .select_from(QueueSession)
            .where(
                QueueSession.service_id == service_id,
                QueueSession.status == QueueSessionStatus.IN_SERVICE,
            )
        )
        in_service_count = (await self.session.execute(in_service_stmt)).scalar() or 0

        # 3. Count active counters
        counter_stmt = (
            select(func.count())
            .select_from(Counter)
            .where(
                Counter.service_id == service_id,
                Counter.status == CounterStatus.ACTIVE,
            )
        )
        active_counters_count = (await self.session.execute(counter_stmt)).scalar() or 0

        # 4. Fetch recent completed service sessions (up to 50 recent sessions)
        ss_stmt = (
            select(ServiceSession)
            .where(
                ServiceSession.service_id == service_id,
                ServiceSession.completed_at.is_not(None),
                ServiceSession.duration_seconds.is_not(None),
            )
            .order_by(ServiceSession.completed_at.desc())
            .limit(50)
        )
        completed_sessions = list((await self.session.execute(ss_stmt)).scalars().all())

        # 5. Fetch latest observation if available
        obs_stmt = (
            select(WaitObservation)
            .where(WaitObservation.service_id == service_id)
            .order_by(WaitObservation.observed_at.desc())
            .limit(1)
        )
        latest_observation = (await self.session.execute(obs_stmt)).scalar_one_or_none()

        # If no counters registered in DB table, fallback to latest observation counters if present
        effective_counters = active_counters_count
        if (
            effective_counters == 0
            and latest_observation
            and latest_observation.active_counters > 0
        ):
            effective_counters = latest_observation.active_counters

        # 6. Calculate data freshness
        latest_timestamps: list[datetime] = []
        if completed_sessions and completed_sessions[0].completed_at:
            latest_timestamps.append(completed_sessions[0].completed_at)
        if latest_observation and latest_observation.observed_at:
            latest_timestamps.append(latest_observation.observed_at)

        if latest_timestamps:
            most_recent_signal = max(latest_timestamps)
            freshness_seconds = max(0, int((now - most_recent_signal).total_seconds()))
        else:
            freshness_seconds = 0

        durations_sec = [
            float(s.duration_seconds) for s in completed_sessions if s.duration_seconds is not None
        ]

        # 7. Execute pure deterministic calculation
        estimator_input = EstimatorInput(
            people_ahead=waiting_count,
            active_counters=effective_counters,
            completed_service_durations_seconds=durations_sec,
            data_freshness_seconds=freshness_seconds,
            observation_wait_minutes=latest_observation.reported_wait_minutes
            if latest_observation
            else None,
        )

        estimate_result: WaitEstimate = self.estimator.estimate(estimator_input)

        # 8. Persist derived estimate if available and requested
        if persist_estimate and estimate_result.is_available:
            persisted_estimate = Estimate(
                service_id=service_id,
                estimated_at=now,
                lower_minutes=estimate_result.lower_minutes or 0.0,
                upper_minutes=estimate_result.upper_minutes or 0.0,
                confidence=estimate_result.confidence.value
                if estimate_result.confidence
                else "LOW",
                sample_size=estimate_result.sample_size,
                data_freshness_seconds=estimate_result.data_freshness_seconds or 0,
                model_version=estimate_result.model_version,
                supporting_signals=estimate_result.supporting_signals,
            )
            self.session.add(persisted_estimate)
            await self.session.commit()

        # 9. Format response payload
        estimate_payload = WaitEstimatePayload(
            is_available=estimate_result.is_available,
            lower_minutes=estimate_result.lower_minutes,
            upper_minutes=estimate_result.upper_minutes,
            expected_minutes=estimate_result.expected_minutes,
            confidence=estimate_result.confidence,
            sample_size=estimate_result.sample_size,
            freshness_seconds=estimate_result.data_freshness_seconds,
            model_version=estimate_result.model_version,
            reason=estimate_result.reason,
            supporting_signals=estimate_result.supporting_signals,
        )

        return QueueStatusResponse(
            service=ServiceResponse.model_validate(service),
            queue_state=QueueStateSummary(
                waiting_count=waiting_count,
                in_service_count=in_service_count,
                active_counters=effective_counters,
            ),
            people_ahead=waiting_count,
            active_counters=effective_counters,
            estimated_wait=estimate_payload,
        )
