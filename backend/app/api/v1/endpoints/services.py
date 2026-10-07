"""Service and queue observation endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.queue import (
    QueueStatusResponse,
    WaitObservationCreate,
    WaitObservationResponse,
)
from app.schemas.service import ServiceCreate, ServiceResponse
from app.services.catalog_service import CatalogService
from app.services.estimation_service import EstimationService
from app.services.observation_service import ObservationService

router = APIRouter(prefix="/services", tags=["Services"])


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    data: ServiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ServiceResponse:
    """Register an operational service queue under a location."""
    catalog = CatalogService(db)
    service = await catalog.create_service(data)
    return ServiceResponse.model_validate(service)


@router.get("", response_model=list[ServiceResponse])
async def list_services(
    db: Annotated[AsyncSession, Depends(get_db)],
    location_id: Annotated[uuid.UUID | None, Query(description="Filter by location")] = None,
) -> list[ServiceResponse]:
    """List operational services, optionally filtered by location."""
    catalog = CatalogService(db)
    services = await catalog.list_services(location_id=location_id)
    return [ServiceResponse.model_validate(s) for s in services]


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ServiceResponse:
    """Retrieve details for a specific service."""
    catalog = CatalogService(db)
    service = await catalog.get_service(service_id)
    return ServiceResponse.model_validate(service)


@router.get("/{service_id}/queue-status", response_model=QueueStatusResponse)
async def get_queue_status(
    service_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> QueueStatusResponse:
    """Retrieve live queue state and deterministic wait projection."""
    estimation_svc = EstimationService(db)
    return await estimation_svc.get_service_queue_status(service_id)


@router.post(
    "/{service_id}/observations",
    response_model=WaitObservationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_observation(
    service_id: uuid.UUID,
    data: WaitObservationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WaitObservationResponse:
    """Submit a crowd or system queue condition observation."""
    obs_svc = ObservationService(db)
    obs = await obs_svc.record_observation(service_id, data)
    return WaitObservationResponse.model_validate(obs)
