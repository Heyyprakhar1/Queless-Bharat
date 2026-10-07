"""Centralized API routing registry."""

from fastapi import APIRouter

from app.api.v1.endpoints import counters, health, locations, queue, services

api_router = APIRouter()

# Mount API v1 route groups
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(locations.router, tags=["Locations"])
api_router.include_router(services.router, tags=["Services"])
api_router.include_router(counters.router, tags=["Counters"])
api_router.include_router(queue.router, tags=["Queue"])
