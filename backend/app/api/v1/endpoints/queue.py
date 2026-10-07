"""Queue session lifecycle endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.queue import (
    CancelQueueRequest,
    CheckInRequest,
    CompleteServiceRequest,
    QueueSessionResponse,
    StartServiceRequest,
    UserQueueStatusResponse,
)
from app.services.estimation_service import EstimationService
from app.services.queue_service import QueueService

router = APIRouter(prefix="/queue", tags=["Queue"])


@router.post("/check-in", response_model=QueueSessionResponse, status_code=status.HTTP_201_CREATED)
async def check_in(
    data: CheckInRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> QueueSessionResponse:
    """Check a participant into a service queue with optional idempotency key."""
    service = QueueService(db)
    queue_session = await service.check_in(
        service_id=data.service_id,
        user_id=data.user_id,
        idempotency_key=data.idempotency_key,
    )
    return QueueSessionResponse.model_validate(queue_session)


@router.get("/{session_id}", response_model=QueueSessionResponse)
async def get_queue_session(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> QueueSessionResponse:
    """Retrieve details and current status of an individual queue session."""
    service = QueueService(db)
    queue_session = await service.get_queue_session(session_id)
    return QueueSessionResponse.model_validate(queue_session)


@router.get("/{session_id}/status", response_model=UserQueueStatusResponse)
async def get_user_queue_status(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserQueueStatusResponse:
    """Retrieve user-centric queue status including line position and wait estimate."""
    estimation_svc = EstimationService(db)
    return await estimation_svc.get_user_queue_status(session_id)


@router.post("/{session_id}/start", response_model=QueueSessionResponse)
async def start_service(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    data: StartServiceRequest | None = None,
) -> QueueSessionResponse:
    """Advance a waiting participant to IN_SERVICE."""
    service = QueueService(db)
    counter_id = data.counter_id if data else None
    idempotency_key = data.idempotency_key if data else None
    queue_session = await service.start_service(
        session_id=session_id,
        counter_id=counter_id,
        idempotency_key=idempotency_key,
    )
    return QueueSessionResponse.model_validate(queue_session)


@router.post("/{session_id}/complete", response_model=QueueSessionResponse)
async def complete_service(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    data: CompleteServiceRequest | None = None,
) -> QueueSessionResponse:
    """Advance an active participant to COMPLETED and record service duration."""
    service = QueueService(db)
    idempotency_key = data.idempotency_key if data else None
    queue_session = await service.complete_service(
        session_id=session_id,
        idempotency_key=idempotency_key,
    )
    return QueueSessionResponse.model_validate(queue_session)


@router.post("/{session_id}/cancel", response_model=QueueSessionResponse)
async def cancel_queue_session(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    data: CancelQueueRequest | None = None,
) -> QueueSessionResponse:
    """Cancel a waiting participant's queue session."""
    service = QueueService(db)
    reason = data.reason if data else None
    idempotency_key = data.idempotency_key if data else None
    queue_session = await service.cancel_queue_session(
        session_id=session_id,
        reason=reason,
        idempotency_key=idempotency_key,
    )
    return QueueSessionResponse.model_validate(queue_session)
