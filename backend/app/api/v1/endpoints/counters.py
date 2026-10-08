"""Counter window management endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_operator
from app.db.session import get_db
from app.domain.enums import UserRole
from app.domain.models import User
from app.schemas.counter import CounterCreate, CounterResponse
from app.services.catalog_service import CatalogService

router = APIRouter(prefix="/counters", tags=["Counters"])


@router.post("", response_model=CounterResponse, status_code=status.HTTP_201_CREATED)
async def create_counter(
    data: CounterCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_operator)],
) -> CounterResponse:
    """Register a physical or logical counter window (Operator / Admin only)."""
    if (
        current_user.role == UserRole.OPERATOR
        and current_user.assigned_service_id
        and data.service_id != current_user.assigned_service_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Operator is not assigned to this service",
        )

    catalog = CatalogService(db)
    counter = await catalog.create_counter(data)
    return CounterResponse.model_validate(counter)


@router.get("", response_model=list[CounterResponse])
async def list_counters(
    db: Annotated[AsyncSession, Depends(get_db)],
    service_id: Annotated[uuid.UUID | None, Query(description="Filter by service")] = None,
    limit: Annotated[int, Query(description="Maximum counters to return", ge=1, le=100)] = 100,
) -> list[CounterResponse]:
    """List counters, optionally filtered by service (Public catalog)."""
    catalog = CatalogService(db)
    counters = await catalog.list_counters(service_id=service_id, limit=limit)
    return [CounterResponse.model_validate(c) for c in counters]
