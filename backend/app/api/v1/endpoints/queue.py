"""Queue session lifecycle endpoints with RBAC and resource-level authorization."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_operator, get_current_user
from app.core.rate_limit import rate_limit_queue_checkin
from app.db.session import get_db
from app.domain.enums import UserRole
from app.domain.models import QueueSession, User
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


def _verify_session_access(session: QueueSession, user: User, action: str = "view") -> None:
    """Enforces resource-level ownership and role boundaries (IDOR/BOLA protection)."""
    if user.role == UserRole.ADMIN:
        return

    if user.role == UserRole.CITIZEN:
        is_owner = (session.user_uuid is not None and session.user_uuid == user.id) or (
            session.user_id is not None and session.user_id == user.email
        )
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: You are not authorized to {action} this queue session",
            )
        return

    if user.role == UserRole.OPERATOR:
        if user.assigned_service_id and session.service_id != user.assigned_service_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Operator is not assigned to this service",
            )
        return


@router.post(
    "/check-in",
    response_model=QueueSessionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_queue_checkin)],
)
async def check_in(
    data: CheckInRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> QueueSessionResponse:
    """Check a participant into a service queue bound to the authenticated user identity."""
    service = QueueService(db)
    queue_session = await service.check_in(
        service_id=data.service_id,
        user_id=data.user_id or current_user.email,
        user_uuid=current_user.id,
        idempotency_key=data.idempotency_key,
    )
    return QueueSessionResponse.model_validate(queue_session)


@router.get("/{session_id}", response_model=QueueSessionResponse)
async def get_queue_session(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> QueueSessionResponse:
    """Retrieve details of an individual queue session with resource ownership check."""
    service = QueueService(db)
    queue_session = await service.get_queue_session(session_id)
    _verify_session_access(queue_session, current_user, action="view")
    return QueueSessionResponse.model_validate(queue_session)


@router.get("/{session_id}/status", response_model=UserQueueStatusResponse)
async def get_user_queue_status(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserQueueStatusResponse:
    """Retrieve user-centric queue status with resource ownership check."""
    queue_svc = QueueService(db)
    queue_session = await queue_svc.get_queue_session(session_id)
    _verify_session_access(queue_session, current_user, action="view")

    estimation_svc = EstimationService(db)
    return await estimation_svc.get_user_queue_status(session_id)


@router.post("/{session_id}/start", response_model=QueueSessionResponse)
async def start_service(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_operator)],
    data: StartServiceRequest | None = None,
) -> QueueSessionResponse:
    """Advance a waiting participant to IN_SERVICE (Operator / Admin only)."""
    service = QueueService(db)
    queue_session = await service.get_queue_session(session_id)
    _verify_session_access(queue_session, current_user, action="operate")

    counter_id = data.counter_id if data else None
    idempotency_key = data.idempotency_key if data else None
    updated_session = await service.start_service(
        session_id=session_id,
        counter_id=counter_id,
        idempotency_key=idempotency_key,
    )
    return QueueSessionResponse.model_validate(updated_session)


@router.post("/{session_id}/complete", response_model=QueueSessionResponse)
async def complete_service(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_operator)],
    data: CompleteServiceRequest | None = None,
) -> QueueSessionResponse:
    """Advance an active participant to COMPLETED (Operator / Admin only)."""
    service = QueueService(db)
    queue_session = await service.get_queue_session(session_id)
    _verify_session_access(queue_session, current_user, action="operate")

    idempotency_key = data.idempotency_key if data else None
    updated_session = await service.complete_service(
        session_id=session_id,
        idempotency_key=idempotency_key,
    )
    return QueueSessionResponse.model_validate(updated_session)


@router.post("/{session_id}/cancel", response_model=QueueSessionResponse)
async def cancel_queue_session(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    data: CancelQueueRequest | None = None,
) -> QueueSessionResponse:
    """Cancel a waiting participant's queue session (Owner Citizen / Operator / Admin)."""
    service = QueueService(db)
    queue_session = await service.get_queue_session(session_id)
    _verify_session_access(queue_session, current_user, action="cancel")

    reason = data.reason if data else None
    idempotency_key = data.idempotency_key if data else None
    updated_session = await service.cancel_queue_session(
        session_id=session_id,
        reason=reason,
        idempotency_key=idempotency_key,
    )
    return QueueSessionResponse.model_validate(updated_session)
