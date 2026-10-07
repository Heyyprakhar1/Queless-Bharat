"""PostgreSQL database and transactional integrity integration tests."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import (
    CounterStatus,
    EstimateConfidence,
    LocationCategory,
    LocationStatus,
    ObservationSource,
    QueueEventType,
    QueueSessionStatus,
    ServiceStatus,
)
from app.domain.exceptions import (
    DuplicateIdempotencyKeyError,
    InvalidStateTransitionError,
)
from app.domain.models import (
    Counter,
    Estimate,
    QueueEvent,
    QueueSession,
    Service,
    ServiceSession,
    WaitObservation,
)
from app.schemas.location import LocationCreate
from app.schemas.service import ServiceCreate
from app.services.catalog_service import CatalogService
from app.services.queue_service import QueueService


@pytest.fixture
async def sample_service(db_session: AsyncSession) -> Service:
    """Fixture providing a persisted Location and Service."""
    cat = CatalogService(db_session)
    loc = await cat.create_location(
        LocationCreate(
            name="City Hospital",
            category=LocationCategory.HOSPITAL,
            address="123 Hospital Road",
            city="New Delhi",
            state="Delhi",
            timezone="Asia/Kolkata",
            status=LocationStatus.ACTIVE,
        )
    )
    svc = await cat.create_service(
        ServiceCreate(
            location_id=loc.id,
            name="OPD Registration",
            description="General OPD Registration Counter",
            status=ServiceStatus.ACTIVE,
        )
    )
    return svc


class TestDatabaseTransactions:
    """Tests real PostgreSQL constraints, foreign keys, transactions, and event immutability."""

    async def test_successful_check_in_and_event_creation(
        self, db_session: AsyncSession, sample_service: Service
    ):
        """Verifies check-in atomically creates both QueueSession and CHECKED_IN QueueEvent."""
        queue_svc = QueueService(db_session)
        session = await queue_svc.check_in(
            service_id=sample_service.id,
            user_id="user-123",
            idempotency_key="key-checkin-1",
        )

        assert session.id is not None
        assert session.status == QueueSessionStatus.WAITING
        assert session.checked_in_at is not None

        # Verify event created in PostgreSQL
        stmt = select(QueueEvent).where(QueueEvent.queue_session_id == session.id)
        events = list((await db_session.execute(stmt)).scalars().all())
        assert len(events) == 1
        assert events[0].event_type == QueueEventType.CHECKED_IN
        assert events[0].idempotency_key == "key-checkin-1"
        assert events[0].event_metadata["user_id"] == "user-123"

    async def test_start_service_transaction(
        self, db_session: AsyncSession, sample_service: Service
    ):
        """Verifies starting service transitions state, creates ServiceSession, and logs event."""
        # Create a counter
        counter = Counter(
            service_id=sample_service.id,
            name="Counter 1",
            status=CounterStatus.ACTIVE.value,
        )
        db_session.add(counter)
        await db_session.commit()
        await db_session.refresh(counter)

        queue_svc = QueueService(db_session)
        session = await queue_svc.check_in(service_id=sample_service.id)

        started = await queue_svc.start_service(
            session_id=session.id,
            counter_id=counter.id,
            idempotency_key="key-start-1",
        )
        assert started.status == QueueSessionStatus.IN_SERVICE
        assert started.service_started_at is not None

        # Verify ServiceSession
        ss_stmt = select(ServiceSession).where(ServiceSession.queue_session_id == session.id)
        service_sessions = list((await db_session.execute(ss_stmt)).scalars().all())
        assert len(service_sessions) == 1
        assert service_sessions[0].counter_id == counter.id
        assert service_sessions[0].completed_at is None

        # Verify event sequence
        ev_stmt = (
            select(QueueEvent)
            .where(QueueEvent.queue_session_id == session.id)
            .order_by(QueueEvent.created_at.asc())
        )
        events = list((await db_session.execute(ev_stmt)).scalars().all())
        assert len(events) == 2
        assert events[0].event_type == QueueEventType.CHECKED_IN
        assert events[1].event_type == QueueEventType.SERVICE_STARTED

    async def test_complete_service_transaction(
        self, db_session: AsyncSession, sample_service: Service
    ):
        """Verifies service completion computes duration and closes ServiceSession."""
        queue_svc = QueueService(db_session)
        session = await queue_svc.check_in(service_id=sample_service.id)
        await queue_svc.start_service(session_id=session.id)

        completed = await queue_svc.complete_service(
            session_id=session.id,
            idempotency_key="key-complete-1",
        )
        assert completed.status == QueueSessionStatus.COMPLETED
        assert completed.completed_at is not None

        # Verify ServiceSession duration
        ss_stmt = select(ServiceSession).where(ServiceSession.queue_session_id == session.id)
        service_session = (await db_session.execute(ss_stmt)).scalar_one()
        assert service_session.completed_at is not None
        assert service_session.duration_seconds is not None
        assert service_session.duration_seconds >= 0

        # Verify event
        ev_stmt = select(QueueEvent).where(
            QueueEvent.queue_session_id == session.id,
            QueueEvent.event_type == QueueEventType.SERVICE_COMPLETED,
        )
        ev = (await db_session.execute(ev_stmt)).scalar_one()
        assert ev.idempotency_key == "key-complete-1"

    async def test_cancel_queue_session_transaction(
        self, db_session: AsyncSession, sample_service: Service
    ):
        """Verifies cancellation transitions state and logs CANCELLED event with metadata."""
        queue_svc = QueueService(db_session)
        session = await queue_svc.check_in(service_id=sample_service.id)

        cancelled = await queue_svc.cancel_queue_session(
            session_id=session.id,
            reason="User had to leave",
            idempotency_key="key-cancel-1",
        )
        assert cancelled.status == QueueSessionStatus.CANCELLED
        assert cancelled.cancelled_at is not None

        # Verify event
        ev_stmt = select(QueueEvent).where(
            QueueEvent.queue_session_id == session.id,
            QueueEvent.event_type == QueueEventType.CANCELLED,
        )
        ev = (await db_session.execute(ev_stmt)).scalar_one()
        assert ev.event_metadata["reason"] == "User had to leave"

    async def test_invalid_transition_rejection(
        self, db_session: AsyncSession, sample_service: Service
    ):
        """Verifies invalid transitions raise exceptions without modifying state."""
        queue_svc = QueueService(db_session)
        session = await queue_svc.check_in(service_id=sample_service.id)

        # Cannot complete a session directly from WAITING
        with pytest.raises(InvalidStateTransitionError) as exc_info:
            await queue_svc.complete_service(session_id=session.id)
        assert exc_info.value.current_status == QueueSessionStatus.WAITING
        assert exc_info.value.target_status == QueueSessionStatus.COMPLETED

        # Check state is unchanged
        fresh_session = await queue_svc.get_queue_session(session.id)
        assert fresh_session.status == QueueSessionStatus.WAITING

        # Complete properly, then verify terminal state cannot transition
        await queue_svc.start_service(session_id=session.id)
        await queue_svc.complete_service(session_id=session.id)

        # COMPLETED cannot be cancelled
        with pytest.raises(InvalidStateTransitionError):
            await queue_svc.cancel_queue_session(session_id=session.id)

        # COMPLETED cannot be started again
        with pytest.raises(InvalidStateTransitionError):
            await queue_svc.start_service(session_id=session.id)

    async def test_duplicate_idempotency_key_behavior(
        self, db_session: AsyncSession, sample_service: Service
    ):
        """Verifies identical idempotency key returns original session without duplicate records."""
        queue_svc = QueueService(db_session)
        session1 = await queue_svc.check_in(
            service_id=sample_service.id,
            user_id="alice",
            idempotency_key="idem-unique-123",
        )
        # Replay with same key
        session2 = await queue_svc.check_in(
            service_id=sample_service.id,
            user_id="alice",
            idempotency_key="idem-unique-123",
        )
        assert session1.id == session2.id

        # Total events with that key must strictly be 1
        ev_stmt = select(QueueEvent).where(QueueEvent.idempotency_key == "idem-unique-123")
        events = list((await db_session.execute(ev_stmt)).scalars().all())
        assert len(events) == 1

        # Attempting to use the same idempotency key for a different action raises conflict
        with pytest.raises(DuplicateIdempotencyKeyError):
            await queue_svc.start_service(
                session_id=session1.id,
                idempotency_key="idem-unique-123",
            )

    async def test_foreign_key_and_check_constraints(
        self, db_session: AsyncSession, sample_service: Service
    ):
        """Verifies PostgreSQL enforces foreign keys and check constraints."""
        svc_id = sample_service.id

        # Non-existent service foreign key on queue session
        bad_session = QueueSession(
            service_id=uuid.uuid4(),  # non-existent
            status=QueueSessionStatus.WAITING.value,
            checked_in_at=datetime.now(UTC),
        )
        db_session.add(bad_session)
        with pytest.raises((IntegrityError, DBAPIError)):
            await db_session.commit()
        await db_session.rollback()

        # Check constraint violation on wait_observations: negative people_ahead
        bad_obs = WaitObservation(
            service_id=svc_id,
            observed_at=datetime.now(UTC),
            people_ahead=-5,  # violates chk_wait_obs_people_ahead
            active_counters=2,
            source=ObservationSource.USER_REPORTED.value,
        )
        db_session.add(bad_obs)
        with pytest.raises((IntegrityError, DBAPIError)):
            await db_session.commit()
        await db_session.rollback()

    async def test_estimate_and_observation_persistence(
        self, db_session: AsyncSession, sample_service: Service
    ):
        """Verifies valid Estimate and WaitObservation entities persist with constraints."""
        now = datetime.now(UTC)

        # 1. Observation
        obs = WaitObservation(
            service_id=sample_service.id,
            observed_at=now,
            people_ahead=12,
            reported_wait_minutes=35.0,
            active_counters=2,
            source=ObservationSource.SYSTEM.value,
        )
        db_session.add(obs)
        await db_session.commit()
        await db_session.refresh(obs)
        assert obs.id is not None
        assert obs.people_ahead == 12

        # 2. Estimate
        est = Estimate(
            service_id=sample_service.id,
            estimated_at=now,
            lower_minutes=25.0,
            upper_minutes=45.0,
            confidence=EstimateConfidence.MEDIUM.value,
            sample_size=15,
            data_freshness_seconds=120,
            model_version="v1-deterministic",
            supporting_signals={"people_ahead": 12, "active_counters": 2},
        )
        db_session.add(est)
        await db_session.commit()
        await db_session.refresh(est)
        assert est.id is not None
        assert est.upper_minutes >= est.lower_minutes
