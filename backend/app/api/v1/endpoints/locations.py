"""Location management endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.domain.models import User
from app.schemas.location import LocationCreate, LocationResponse
from app.services.catalog_service import CatalogService

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    data: LocationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin)],
) -> LocationResponse:
    """Register a new physical public service institution (Admin only)."""
    service = CatalogService(db)
    location = await service.create_location(data)
    return LocationResponse.model_validate(location)


@router.get("/cities", response_model=list[str])
async def list_cities(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[str]:
    """List distinct cities with registered locations (Public catalog)."""
    service = CatalogService(db)
    return await service.list_cities()


@router.get("", response_model=list[LocationResponse])
async def list_locations(
    db: Annotated[AsyncSession, Depends(get_db)],
    city: Annotated[str | None, Query(description="Filter locations by city")] = None,
    limit: Annotated[int, Query(description="Maximum locations to return", ge=1, le=100)] = 100,
) -> list[LocationResponse]:
    """List registered locations, optionally filtered by city (Public catalog)."""
    service = CatalogService(db)
    locations = await service.list_locations(city=city, limit=limit)
    return [LocationResponse.model_validate(loc) for loc in locations]


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LocationResponse:
    """Retrieve details for a specific location (Public catalog)."""
    service = CatalogService(db)
    location = await service.get_location(location_id)
    return LocationResponse.model_validate(location)
