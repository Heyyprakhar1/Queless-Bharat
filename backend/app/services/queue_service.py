"""Queue lifecycle service managing atomic state transitions and immutable audit events."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import (
    CounterStatus,
    QueueEventType,
    QueueSessionStatus,
    ServiceStatus,
)
from app.domain.exceptions import (
    DomainError,
    DuplicateIdempotencyKeyError,
    InvalidStateTransitionError,
    ResourceNotFoundError,
)
from app.domain.models import Counter, QueueEvent, QueueSession, Service, ServiceSession


class QueueService:
    """Orchestrates transactional queue operations and state machine enforcement."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def check_in(
        self,
        service_id: uuid.UUID,
        user_id: str | None = None,
        user_uuid: uuid.UUID | None = None,
        idempotency_key: str | None = None,
    ) -> QueueSession:
        """Atomically checks a participant into a service queue with optional idempotency key.

        Args:
            service_id: Target service identifier.
            user_id: Optional client-provided identifier.
            user_uuid: Optional authenticated user account identifier.
            idempotency_key: Client deduplication key.

        Returns:
            QueueSession: Persisted or previously processed queue session.
        """
        # 1. Check for existing idempotency key
        if idempotency_key:
            stmt = select(QueueEvent).where(QueueEvent.idempotency_key == idempotency_key)
            existing_event = (await self.session.execute(stmt)).scalar_one_or_none()
            if existing_event:
                if existing_event.event_type == QueueEventType.CHECKED_IN:
                    # Return previously created session
                    return await self.get_queue_session(existing_event.queue_session_id)
                raise DuplicateIdempotencyKeyError(idempotency_key)

        # 2. Verify service exists and is active
        svc_stmt = select(Service).where(Service.id == service_id)
        service = (await self.session.execute(svc_stmt)).scalar_one_or_none()
        if not service:
            raise ResourceNotFoundError("Service", str(service_id))
        if service.status != ServiceStatus.ACTIVE:
            raise DomainError(f"Service '{service_id}' is inactive and cannot accept check-ins")

        now = datetime.now(UTC)
        queue_session = QueueSession(
            service_id=service_id,
            user_id=user_id,
            user_uuid=user_uuid,
            status=QueueSessionStatus.WAITING,
            checked_in_at=now,
        )
        self.session.add(queue_session)
        await self.session.flush()

        queue_event = QueueEvent(
            queue_session_id=queue_session.id,
            event_type=QueueEventType.CHECKED_IN,
            event_time=now,
            idempotency_key=idempotency_key,
            event_metadata={"service_id": str(service_id), "user_id": user_id},
        )
        self.session.add(queue_event)

        try:
            await self.session.commit()
            await self.session.refresh(queue_session)
            return queue_session
        except IntegrityError as exc:
            await self.session.rollback()
            if idempotency_key and "idempotency_key" in str(exc):
                # Race condition duplicate check-in with same key: fetch existing
                stmt = select(QueueEvent).where(QueueEvent.idempotency_key == idempotency_key)
                existing = (await self.session.execute(stmt)).scalar_one_or_none()
                if existing and existing.event_type == QueueEventType.CHECKED_IN:
                    return await self.get_queue_session(existing.queue_session_id)
                raise DuplicateIdempotencyKeyError(idempotency_key) from exc
            raise

    async def get_queue_session(
        self, session_id: uuid.UUID, for_update: bool = False
    ) -> QueueSession:
        """Retrieves a queue session by identifier, optionally acquiring a row-level lock."""
        stmt = select(QueueSession).where(QueueSession.id == session_id)
        if for_update:
            stmt = stmt.with_for_update().execution_options(populate_existing=True)
        session_obj = (await self.session.execute(stmt)).scalar_one_or_none()
        if not session_obj:
            raise ResourceNotFoundError("QueueSession", str(session_id))
        return session_obj

    async def start_service(
        self,
        session_id: uuid.UUID,
        counter_id: uuid.UUID | None = None,
        idempotency_key: str | None = None,
    ) -> QueueSession:
        """Transitions a WAITING participant to IN_SERVICE and opens a ServiceSession
        (concurrency safe).
        """
        queue_session = await self.get_queue_session(session_id, for_update=True)

        # 1. Check idempotency key
        if idempotency_key:
            stmt = select(QueueEvent).where(QueueEvent.idempotency_key == idempotency_key)
            existing_event = (await self.session.execute(stmt)).scalar_one_or_none()
            if existing_event:
                if (
                    existing_event.event_type == QueueEventType.SERVICE_STARTED
                    and existing_event.queue_session_id == session_id
                ):
                    return queue_session
                raise DuplicateIdempotencyKeyError(idempotency_key)

        # 2. State invariant verification
        if queue_session.status != QueueSessionStatus.WAITING:
            raise InvalidStateTransitionError(queue_session.status, QueueSessionStatus.IN_SERVICE)

        # 3. Ensure no concurrent/duplicate active ServiceSession exists
        existing_ss_stmt = (
            select(ServiceSession)
            .where(
                ServiceSession.queue_session_id == session_id,
                ServiceSession.completed_at.is_(None),
            )
            .limit(1)
        )
        existing_ss = (await self.session.execute(existing_ss_stmt)).scalar_one_or_none()
        if existing_ss:
            raise DomainError(f"Queue session {session_id} already has an active service session")

        # 4. Validate counter if specified
        if counter_id:
            c_stmt = select(Counter).where(Counter.id == counter_id)
            counter = (await self.session.execute(c_stmt)).scalar_one_or_none()
            if not counter:
                raise ResourceNotFoundError("Counter", str(counter_id))
            if counter.service_id != queue_session.service_id:
                raise DomainError(
                    f"Counter {counter_id} does not belong to service {queue_session.service_id}"
                )
            if counter.status != CounterStatus.ACTIVE:
                raise DomainError(
                    f"Counter {counter_id} is not active (current status: {counter.status})"
                )

        now = datetime.now(UTC)
        queue_session.status = QueueSessionStatus.IN_SERVICE
        queue_session.service_started_at = now

        service_session = ServiceSession(
            queue_session_id=queue_session.id,
            service_id=queue_session.service_id,
            counter_id=counter_id,
            started_at=now,
        )
        self.session.add(service_session)

        queue_event = QueueEvent(
            queue_session_id=queue_session.id,
            event_type=QueueEventType.SERVICE_STARTED,
            event_time=now,
            idempotency_key=idempotency_key,
            event_metadata={"counter_id": str(counter_id) if counter_id else None},
        )
        self.session.add(queue_event)

        try:
            await self.session.commit()
            await self.session.refresh(queue_session)
            return queue_session
        except IntegrityError as exc:
            await self.session.rollback()
            if idempotency_key and "idempotency_key" in str(exc):
                raise DuplicateIdempotencyKeyError(idempotency_key) from exc
            raise

    async def complete_service(
        self,
        session_id: uuid.UUID,
        idempotency_key: str | None = None,
    ) -> QueueSession:
        """Transitions an IN_SERVICE participant to COMPLETED and closes the ServiceSession
        (concurrency safe).
        """
        queue_session = await self.get_queue_session(session_id, for_update=True)

        # 1. Check idempotency key
        if idempotency_key:
            stmt = select(QueueEvent).where(QueueEvent.idempotency_key == idempotency_key)
            existing_event = (await self.session.execute(stmt)).scalar_one_or_none()
            if existing_event:
                if (
                    existing_event.event_type == QueueEventType.SERVICE_COMPLETED
                    and existing_event.queue_session_id == session_id
                ):
                    return queue_session
                raise DuplicateIdempotencyKeyError(idempotency_key)

        # 2. State invariant verification
        if queue_session.status != QueueSessionStatus.IN_SERVICE:
            raise InvalidStateTransitionError(queue_session.status, QueueSessionStatus.COMPLETED)

        now = datetime.now(UTC)
        queue_session.status = QueueSessionStatus.COMPLETED
        queue_session.completed_at = now

        # 3. Find and close open ServiceSession with row lock
        ss_stmt = (
            select(ServiceSession)
            .where(
                ServiceSession.queue_session_id == session_id,
                ServiceSession.completed_at.is_(None),
            )
            .order_by(ServiceSession.started_at.desc())
            .with_for_update()
            .limit(1)
        )
        active_service_session = (await self.session.execute(ss_stmt)).scalar_one_or_none()
        if active_service_session:
            active_service_session.completed_at = now
            duration = int((now - active_service_session.started_at).total_seconds())
            active_service_session.duration_seconds = max(0, duration)

        queue_event = QueueEvent(
            queue_session_id=queue_session.id,
            event_type=QueueEventType.SERVICE_COMPLETED,
            event_time=now,
            idempotency_key=idempotency_key,
            event_metadata={
                "completed_at": now.isoformat(),
                "duration_seconds": active_service_session.duration_seconds
                if active_service_session
                else None,
            },
        )
        self.session.add(queue_event)

        try:
            await self.session.commit()
            await self.session.refresh(queue_session)
            return queue_session
        except IntegrityError as exc:
            await self.session.rollback()
            if idempotency_key and "idempotency_key" in str(exc):
                raise DuplicateIdempotencyKeyError(idempotency_key) from exc
            raise

    async def cancel_queue_session(
        self,
        session_id: uuid.UUID,
        reason: str | None = None,
        idempotency_key: str | None = None,
    ) -> QueueSession:
        """Transitions a WAITING participant to CANCELLED (concurrency safe)."""
        queue_session = await self.get_queue_session(session_id, for_update=True)

        # 1. Check idempotency key
        if idempotency_key:
            stmt = select(QueueEvent).where(QueueEvent.idempotency_key == idempotency_key)
            existing_event = (await self.session.execute(stmt)).scalar_one_or_none()
            if existing_event:
                if (
                    existing_event.event_type == QueueEventType.CANCELLED
                    and existing_event.queue_session_id == session_id
                ):
                    return queue_session
                raise DuplicateIdempotencyKeyError(idempotency_key)

        # 2. State invariant: only WAITING can be cancelled
        if queue_session.status != QueueSessionStatus.WAITING:
            raise InvalidStateTransitionError(queue_session.status, QueueSessionStatus.CANCELLED)

        now = datetime.now(UTC)
        queue_session.status = QueueSessionStatus.CANCELLED
        queue_session.cancelled_at = now

        queue_event = QueueEvent(
            queue_session_id=queue_session.id,
            event_type=QueueEventType.CANCELLED,
            event_time=now,
            idempotency_key=idempotency_key,
            event_metadata={"reason": reason} if reason else {},
        )
        self.session.add(queue_event)

        try:
            await self.session.commit()
            await self.session.refresh(queue_session)
            return queue_session
        except IntegrityError as exc:
            await self.session.rollback()
            if idempotency_key and "idempotency_key" in str(exc):
                raise DuplicateIdempotencyKeyError(idempotency_key) from exc
            raise
