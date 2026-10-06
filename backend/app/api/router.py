"""Centralized API routing registry."""

from fastapi import APIRouter

from app.api.v1.endpoints import health

api_router = APIRouter()

# Mount API v1 route groups
api_router.include_router(health.router, tags=["Health"])
