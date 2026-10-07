"""Location management endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.location import LocationCreate, LocationResponse
from app.services.catalog_service import CatalogService

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    data: LocationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LocationResponse:
    """Register a new physical public service institution."""
    service = CatalogService(db)
    location = await service.create_location(data)
    return LocationResponse.model_validate(location)


@router.get("", response_model=list[LocationResponse])
async def list_locations(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[LocationResponse]:
    """List all registered locations."""
    service = CatalogService(db)
    locations = await service.list_locations()
    return [LocationResponse.model_validate(loc) for loc in locations]


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LocationResponse:
    """Retrieve details for a specific location."""
    service = CatalogService(db)
    location = await service.get_location(location_id)
    return LocationResponse.model_validate(location)
