"""SQLAlchemy DeclarativeBase metadata definition."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy declarative models."""

    pass


# Ensure all domain models are registered on Base.metadata
import app.domain.models  # noqa: E402, F401
