"""Centralized API routing registry."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, counters, health, locations, queue, services

api_router = APIRouter()

# Mount API v1 route groups
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, tags=["Authentication"])
api_router.include_router(locations.router, tags=["Locations"])
api_router.include_router(services.router, tags=["Services"])
api_router.include_router(counters.router, tags=["Counters"])
api_router.include_router(queue.router, tags=["Queue"])

# Admin router alias for /admin/users
admin_router = APIRouter(prefix="/admin", tags=["Admin"])
admin_router.add_api_route(
    "/users",
    auth.create_privileged_user,
    methods=["POST"],
    response_model=auth.UserResponse,
    status_code=201,
    summary="Create privileged user (Admin only alias)",
)
api_router.include_router(admin_router)
