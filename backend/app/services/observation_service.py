"""Wait observation service for recording system and citizen queue reports."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import ResourceNotFoundError
from app.domain.models import Service, WaitObservation
from app.schemas.queue import WaitObservationCreate


class ObservationService:
    """Handles persistence and retrieval of point-in-time queue condition observations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record_observation(
        self,
        service_id: uuid.UUID,
        data: WaitObservationCreate,
    ) -> WaitObservation:
        """Records a point-in-time wait observation for a service."""
        # Verify service exists
        svc_stmt = select(Service).where(Service.id == service_id)
        service = (await self.session.execute(svc_stmt)).scalar_one_or_none()
        if not service:
            raise ResourceNotFoundError("Service", str(service_id))

        now = datetime.now(UTC)
        observation = WaitObservation(
            service_id=service_id,
            observed_at=now,
            people_ahead=data.people_ahead,
            reported_wait_minutes=data.reported_wait_minutes,
            active_counters=data.active_counters,
            source=data.source.value,
        )
        self.session.add(observation)
        await self.session.commit()
        await self.session.refresh(observation)
        return observation

    async def list_recent_observations(
        self,
        service_id: uuid.UUID,
        limit: int = 10,
    ) -> list[WaitObservation]:
        """Lists the most recent observations for a service."""
        stmt = (
            select(WaitObservation)
            .where(WaitObservation.service_id == service_id)
            .order_by(WaitObservation.observed_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
