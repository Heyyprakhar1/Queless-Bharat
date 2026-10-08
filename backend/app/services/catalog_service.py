"""Catalog service for managing Locations, Services, and Counters."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import ResourceNotFoundError
from app.domain.models import Counter, Location, Service
from app.schemas.counter import CounterCreate
from app.schemas.location import LocationCreate
from app.schemas.service import ServiceCreate


class CatalogService:
    """Provides administrative and query operations for locations and services."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_location(self, data: LocationCreate) -> Location:
        """Creates and persists a new physical location."""
        location = Location(
            name=data.name,
            category=data.category.value,
            address=data.address,
            city=data.city,
            state=data.state,
            timezone=data.timezone,
            latitude=data.latitude,
            longitude=data.longitude,
            status=data.status.value,
        )
        self.session.add(location)
        await self.session.commit()
        await self.session.refresh(location)
        return location

    async def get_location(self, location_id: uuid.UUID) -> Location:
        """Retrieves a location by its identifier."""
        result = await self.session.execute(select(Location).where(Location.id == location_id))
        location = result.scalar_one_or_none()
        if not location:
            raise ResourceNotFoundError("Location", str(location_id))
        return location

    async def list_cities(self) -> list[str]:
        """Lists distinct cities with registered locations."""
        result = await self.session.execute(
            select(Location.city).distinct().order_by(Location.city.asc())
        )
        return [row[0] for row in result.all()]

    async def list_locations(self, city: str | None = None) -> list[Location]:
        """Lists registered locations, optionally filtered by city."""
        stmt = select(Location).order_by(Location.name.asc())
        if city:
            stmt = stmt.where(func.lower(Location.city) == city.strip().lower())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_service(self, data: ServiceCreate) -> Service:
        """Creates and persists a new service under a location."""
        # Verify location exists
        await self.get_location(data.location_id)

        service = Service(
            location_id=data.location_id,
            name=data.name,
            description=data.description,
            status=data.status.value,
        )
        self.session.add(service)
        await self.session.commit()
        await self.session.refresh(service)
        return service

    async def get_service(self, service_id: uuid.UUID) -> Service:
        """Retrieves a service by its identifier."""
        result = await self.session.execute(select(Service).where(Service.id == service_id))
        service = result.scalar_one_or_none()
        if not service:
            raise ResourceNotFoundError("Service", str(service_id))
        return service

    async def list_services(self, location_id: uuid.UUID | None = None) -> list[Service]:
        """Lists services, optionally filtered by location."""
        stmt = select(Service).order_by(Service.name.asc())
        if location_id:
            stmt = stmt.where(Service.location_id == location_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_counter(self, data: CounterCreate) -> Counter:
        """Creates and persists a counter under a service."""
        # Verify service exists
        await self.get_service(data.service_id)

        counter = Counter(
            service_id=data.service_id,
            name=data.name,
            status=data.status.value,
        )
        self.session.add(counter)
        await self.session.commit()
        await self.session.refresh(counter)
        return counter

    async def list_counters(self, service_id: uuid.UUID | None = None) -> list[Counter]:
        """Lists counters, optionally filtered by service."""
        stmt = select(Counter).order_by(Counter.name.asc())
        if service_id:
            stmt = stmt.where(Counter.service_id == service_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
