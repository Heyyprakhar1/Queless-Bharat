"""Estimation orchestration service integrating DB state with deterministic queue engine."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import CounterStatus, EstimateConfidence, QueueSessionStatus
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
    QueueSessionResponse,
    QueueStateSummary,
    QueueStatusResponse,
    UserQueueStatusResponse,
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

    async def _resolve_effective_counters(
        self, service_id: uuid.UUID, now: datetime
    ) -> tuple[int, WaitObservation | None]:
        """Resolves active counters with strict precedence:
        1. If registered Counter entities exist for this service, the count of
           Counter(status=ACTIVE) is authoritative. If 0 are active, effective
           count is 0 (service halted). Stale or conflicting observations MUST NOT
           override 0 active counters.
        2. If NO counters are registered in the DB table (unmanaged/crowdsourced service),
           fall back to latest observation's active_counters ONLY if the observation exists,
           has active_counters > 0, and is fresh (<= 1800 seconds / 30 minutes).
        """
        # Query total registered counters for the service
        total_counters_stmt = (
            select(func.count()).select_from(Counter).where(Counter.service_id == service_id)
        )
        total_registered_counters = (await self.session.execute(total_counters_stmt)).scalar() or 0

        # Query active counters
        active_counter_stmt = (
            select(func.count())
            .select_from(Counter)
            .where(
                Counter.service_id == service_id,
                Counter.status == CounterStatus.ACTIVE,
            )
        )
        active_counters_count = (await self.session.execute(active_counter_stmt)).scalar() or 0

        # Query latest observation
        obs_stmt = (
            select(WaitObservation)
            .where(WaitObservation.service_id == service_id)
            .order_by(WaitObservation.observed_at.desc())
            .limit(1)
        )
        latest_observation = (await self.session.execute(obs_stmt)).scalar_one_or_none()

        if total_registered_counters > 0:
            # Registered counters in DB are authoritative
            return active_counters_count, latest_observation

        # Fallback to crowdsourced observation only when unmanaged
        # AND fresh (<= 1800 seconds / 30 minutes)
        if (
            latest_observation
            and latest_observation.active_counters > 0
            and latest_observation.observed_at
        ):
            obs_age_seconds = (now - latest_observation.observed_at).total_seconds()
            if 0 <= obs_age_seconds <= 1800:
                return latest_observation.active_counters, latest_observation

        return 0, latest_observation

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

        # 3. Resolve active counters with authoritative DB counter precedence
        effective_counters, latest_observation = await self._resolve_effective_counters(
            service_id, now
        )

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

        # 9. Format response payload with demo/simulation indication
        estimate_result.supporting_signals.setdefault("is_simulated", True)
        estimate_result.supporting_signals.setdefault(
            "simulation_notice", "DEMO / SIMULATED DATA — Not live queue measurements"
        )

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
            is_simulated=True,
        )

    async def get_user_queue_status(
        self,
        session_id: uuid.UUID,
    ) -> UserQueueStatusResponse:
        """Retrieves user-centric queue status including position and personal wait estimate."""
        # 1. Verify queue session exists
        sess_stmt = select(QueueSession).where(QueueSession.id == session_id)
        queue_session = (await self.session.execute(sess_stmt)).scalar_one_or_none()
        if not queue_session:
            raise ResourceNotFoundError("QueueSession", str(session_id))

        # 2. Verify service exists
        svc_stmt = select(Service).where(Service.id == queue_session.service_id)
        service = (await self.session.execute(svc_stmt)).scalar_one_or_none()
        if not service:
            raise ResourceNotFoundError("Service", str(queue_session.service_id))

        now = datetime.now(UTC)

        # 3. Overall queue state metrics
        waiting_stmt = (
            select(func.count())
            .select_from(QueueSession)
            .where(
                QueueSession.service_id == service.id,
                QueueSession.status == QueueSessionStatus.WAITING,
            )
        )
        waiting_count = (await self.session.execute(waiting_stmt)).scalar() or 0

        in_service_stmt = (
            select(func.count())
            .select_from(QueueSession)
            .where(
                QueueSession.service_id == service.id,
                QueueSession.status == QueueSessionStatus.IN_SERVICE,
            )
        )
        in_service_count = (await self.session.execute(in_service_stmt)).scalar() or 0

        # Active counters resolved via authoritative precedence
        effective_counters, latest_observation = await self._resolve_effective_counters(
            service.id, now
        )

        queue_state = QueueStateSummary(
            waiting_count=waiting_count,
            in_service_count=in_service_count,
            active_counters=effective_counters,
        )

        # 4. Handle Terminal & In-Service States
        if queue_session.status == QueueSessionStatus.IN_SERVICE:
            return UserQueueStatusResponse(
                session=QueueSessionResponse.model_validate(queue_session),
                service=ServiceResponse.model_validate(service),
                position=None,
                people_ahead=0,
                queue_state=queue_state,
                estimated_wait=WaitEstimatePayload(
                    is_available=True,
                    lower_minutes=0.0,
                    upper_minutes=0.0,
                    expected_minutes=0.0,
                    confidence=EstimateConfidence.HIGH,
                    sample_size=0,
                    model_version=self.estimator.model_version,
                    reason="Currently in service",
                ),
            )

        if queue_session.status == QueueSessionStatus.COMPLETED:
            return UserQueueStatusResponse(
                session=QueueSessionResponse.model_validate(queue_session),
                service=ServiceResponse.model_validate(service),
                position=None,
                people_ahead=0,
                queue_state=queue_state,
                estimated_wait=WaitEstimatePayload(
                    is_available=False,
                    reason="Service completed",
                    model_version=self.estimator.model_version,
                ),
            )

        if queue_session.status == QueueSessionStatus.CANCELLED:
            return UserQueueStatusResponse(
                session=QueueSessionResponse.model_validate(queue_session),
                service=ServiceResponse.model_validate(service),
                position=None,
                people_ahead=0,
                queue_state=queue_state,
                estimated_wait=WaitEstimatePayload(
                    is_available=False,
                    reason="Queue session cancelled",
                    model_version=self.estimator.model_version,
                ),
            )

        # 5. WAITING State: calculate FIFO people ahead and personalized wait
        people_ahead_stmt = (
            select(func.count())
            .select_from(QueueSession)
            .where(
                QueueSession.service_id == service.id,
                QueueSession.status == QueueSessionStatus.WAITING,
                (QueueSession.checked_in_at < queue_session.checked_in_at)
                | (
                    (QueueSession.checked_in_at == queue_session.checked_in_at)
                    & (QueueSession.id < queue_session.id)
                ),
            )
        )
        people_ahead = (await self.session.execute(people_ahead_stmt)).scalar() or 0
        position = people_ahead + 1

        # Completed sessions for throughput
        ss_stmt = (
            select(ServiceSession)
            .where(
                ServiceSession.service_id == service.id,
                ServiceSession.completed_at.is_not(None),
                ServiceSession.duration_seconds.is_not(None),
            )
            .order_by(ServiceSession.completed_at.desc())
            .limit(50)
        )
        completed_sessions = list((await self.session.execute(ss_stmt)).scalars().all())

        latest_timestamps: list[datetime] = []
        if completed_sessions and completed_sessions[0].completed_at:
            latest_timestamps.append(completed_sessions[0].completed_at)
        if latest_observation and latest_observation.observed_at:
            latest_timestamps.append(latest_observation.observed_at)

        freshness_seconds = 0
        if latest_timestamps:
            freshness_seconds = max(0, int((now - max(latest_timestamps)).total_seconds()))

        durations_sec = [
            float(s.duration_seconds) for s in completed_sessions if s.duration_seconds is not None
        ]

        # Calculate personalized wait estimate using user's people_ahead
        est_input = EstimatorInput(
            people_ahead=people_ahead,
            active_counters=effective_counters,
            completed_service_durations_seconds=durations_sec,
            data_freshness_seconds=freshness_seconds,
            observation_wait_minutes=latest_observation.reported_wait_minutes
            if latest_observation
            else None,
        )
        estimate_result = self.estimator.estimate(est_input)

        estimate_result.supporting_signals.setdefault("is_simulated", True)
        estimate_result.supporting_signals.setdefault(
            "simulation_notice", "DEMO / SIMULATED DATA — Not live queue measurements"
        )

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

        return UserQueueStatusResponse(
            session=QueueSessionResponse.model_validate(queue_session),
            service=ServiceResponse.model_validate(service),
            position=position,
            people_ahead=people_ahead,
            queue_state=queue_state,
            estimated_wait=estimate_payload,
            is_simulated=True,
        )
