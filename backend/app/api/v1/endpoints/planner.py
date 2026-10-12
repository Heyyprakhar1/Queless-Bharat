"""Smart Visit Planner endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import rate_limit_visit_plan
from app.db.session import get_db
from app.schemas.planner import VisitPlanResponse
from app.services.planner_service import PlannerService

router = APIRouter(prefix="/services", tags=["Visit Planner"])


@router.get(
    "/{service_id}/visit-plan",
    response_model=VisitPlanResponse,
    dependencies=[Depends(rate_limit_visit_plan)],
)
async def get_visit_plan(
    service_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VisitPlanResponse:
    """Query deterministic arrival window and verified document checklist for a service."""
    planner = PlannerService(db)
    return await planner.get_visit_plan(service_id)
