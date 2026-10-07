"""Counter window management endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.counter import CounterCreate, CounterResponse
from app.services.catalog_service import CatalogService

router = APIRouter(prefix="/counters", tags=["Counters"])


@router.post("", response_model=CounterResponse, status_code=status.HTTP_201_CREATED)
async def create_counter(
    data: CounterCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CounterResponse:
    """Register a physical or logical counter window under a service."""
    catalog = CatalogService(db)
    counter = await catalog.create_counter(data)
    return CounterResponse.model_validate(counter)


@router.get("", response_model=list[CounterResponse])
async def list_counters(
    db: Annotated[AsyncSession, Depends(get_db)],
    service_id: Annotated[uuid.UUID | None, Query(description="Filter by service")] = None,
) -> list[CounterResponse]:
    """List counters, optionally filtered by service."""
    catalog = CatalogService(db)
    counters = await catalog.list_counters(service_id=service_id)
    return [CounterResponse.model_validate(c) for c in counters]
