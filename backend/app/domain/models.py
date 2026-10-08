"""SQLAlchemy relational domain models for QueueLess Bharat."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base
from app.domain.enums import (
    CounterStatus,
    EstimateConfidence,
    LocationCategory,
    LocationStatus,
    ObservationSource,
    QueueEventType,
    QueueSessionStatus,
    ServiceStatus,
    UserRole,
)

# Use JSONB for PostgreSQL dialect, fallback to standard JSON
JsonType = JSON().with_variant(JSONB, "postgresql")


class Location(Base):
    """Represents a physical public service institution (e.g., Hospital, RTO)."""

    __tablename__ = "locations"
    __table_args__ = (
        CheckConstraint(
            f"category IN ({', '.join(repr(c.value) for c in LocationCategory)})",
            name="chk_locations_category",
        ),
        CheckConstraint(
            f"status IN ('{LocationStatus.ACTIVE}', '{LocationStatus.INACTIVE}')",
            name="chk_locations_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="Asia/Kolkata")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=LocationStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    services: Mapped[list["Service"]] = relationship(
        "Service", back_populates="location", cascade="all, delete-orphan"
    )


class Service(Base):
    """Specific operational queue or service conducted within a location."""

    __tablename__ = "services"
    __table_args__ = (
        CheckConstraint(
            f"status IN ('{ServiceStatus.ACTIVE}', '{ServiceStatus.INACTIVE}')",
            name="chk_services_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=ServiceStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    location: Mapped["Location"] = relationship("Location", back_populates="services")
    counters: Mapped[list["Counter"]] = relationship(
        "Counter", back_populates="service", cascade="all, delete-orphan"
    )
    queue_sessions: Mapped[list["QueueSession"]] = relationship(
        "QueueSession", back_populates="service", cascade="all, delete-orphan"
    )
    wait_observations: Mapped[list["WaitObservation"]] = relationship(
        "WaitObservation", back_populates="service", cascade="all, delete-orphan"
    )
    estimates: Mapped[list["Estimate"]] = relationship(
        "Estimate", back_populates="service", cascade="all, delete-orphan"
    )


class Counter(Base):
    """Physical or logical service window dedicated to a service."""

    __tablename__ = "counters"
    __table_args__ = (
        CheckConstraint(
            f"status IN ('{CounterStatus.ACTIVE}', '{CounterStatus.INACTIVE}', "
            f"'{CounterStatus.MAINTENANCE}')",
            name="chk_counters_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    service_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=CounterStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    service: Mapped["Service"] = relationship("Service", back_populates="counters")
    service_sessions: Mapped[list["ServiceSession"]] = relationship(
        "ServiceSession", back_populates="counter"
    )


class User(Base):
    """Platform identity representing a citizen, operator, or administrator."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            f"role IN ('{UserRole.CITIZEN}', '{UserRole.OPERATOR}', '{UserRole.ADMIN}')",
            name="chk_users_role",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default=UserRole.CITIZEN)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    assigned_service_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("services.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    assigned_service: Mapped["Service | None"] = relationship("Service")
    queue_sessions: Mapped[list["QueueSession"]] = relationship(
        "QueueSession", back_populates="user"
    )


class QueueSession(Base):
    """Represents one participant's individual queue lifecycle."""

    __tablename__ = "queue_sessions"
    __table_args__ = (
        CheckConstraint(
            f"status IN ('{QueueSessionStatus.WAITING}', '{QueueSessionStatus.IN_SERVICE}', "
            f"'{QueueSessionStatus.COMPLETED}', '{QueueSessionStatus.CANCELLED}')",
            name="chk_queue_sessions_status",
        ),
        Index("ix_queue_sessions_service_status", "service_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    service_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_uuid: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=QueueSessionStatus.WAITING
    )
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    service_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    service: Mapped["Service"] = relationship("Service", back_populates="queue_sessions")
    user: Mapped["User | None"] = relationship("User", back_populates="queue_sessions")
    events: Mapped[list["QueueEvent"]] = relationship(
        "QueueEvent", back_populates="queue_session", cascade="all, delete-orphan"
    )
    service_sessions: Mapped[list["ServiceSession"]] = relationship(
        "ServiceSession", back_populates="queue_session", cascade="all, delete-orphan"
    )


class QueueEvent(Base):
    """Immutable, append-only historical queue transition fact."""

    __tablename__ = "queue_events"
    __table_args__ = (
        CheckConstraint(
            f"event_type IN ('{QueueEventType.CHECKED_IN}', '{QueueEventType.SERVICE_STARTED}', "
            f"'{QueueEventType.SERVICE_COMPLETED}', '{QueueEventType.CANCELLED}')",
            name="chk_queue_events_type",
        ),
        Index("ix_queue_events_session_time", "queue_session_id", "event_time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    queue_session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("queue_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    event_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JsonType, nullable=False, default=dict
    )
    idempotency_key: Mapped[str | None] = mapped_column(
        String(128), nullable=True, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    queue_session: Mapped["QueueSession"] = relationship("QueueSession", back_populates="events")


class ServiceSession(Base):
    """Represents actual service throughput for a queue participant at a counter."""

    __tablename__ = "service_sessions"
    __table_args__ = (
        CheckConstraint(
            "duration_seconds IS NULL OR duration_seconds >= 0",
            name="chk_service_sessions_duration",
        ),
        Index("ix_service_sessions_service_completed", "service_id", "completed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    queue_session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("queue_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True
    )
    counter_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("counters.id", ondelete="SET NULL"), nullable=True, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    queue_session: Mapped["QueueSession"] = relationship(
        "QueueSession", back_populates="service_sessions"
    )
    counter: Mapped["Counter | None"] = relationship("Counter", back_populates="service_sessions")


class WaitObservation(Base):
    """Point-in-time observed queue conditions submitted by systems or citizens."""

    __tablename__ = "wait_observations"
    __table_args__ = (
        CheckConstraint("people_ahead >= 0", name="chk_wait_obs_people_ahead"),
        CheckConstraint(
            "reported_wait_minutes IS NULL OR reported_wait_minutes >= 0",
            name="chk_wait_obs_reported_wait",
        ),
        CheckConstraint("active_counters >= 0", name="chk_wait_obs_active_counters"),
        CheckConstraint(
            f"source IN ('{ObservationSource.SYSTEM}', '{ObservationSource.USER_REPORTED}')",
            name="chk_wait_obs_source",
        ),
        Index("ix_wait_observations_service_observed", "service_id", "observed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    service_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True
    )
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    people_ahead: Mapped[int] = mapped_column(Integer, nullable=False)
    reported_wait_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    active_counters: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    service: Mapped["Service"] = relationship("Service", back_populates="wait_observations")


class Estimate(Base):
    """Derived deterministic wait-time estimate calculated for a service."""

    __tablename__ = "estimates"
    __table_args__ = (
        CheckConstraint("lower_minutes >= 0", name="chk_estimates_lower_minutes"),
        CheckConstraint("upper_minutes >= lower_minutes", name="chk_estimates_bounds"),
        CheckConstraint("sample_size >= 0", name="chk_estimates_sample_size"),
        CheckConstraint("data_freshness_seconds >= 0", name="chk_estimates_freshness"),
        CheckConstraint(
            f"confidence IN ('{EstimateConfidence.LOW}', '{EstimateConfidence.MEDIUM}', "
            f"'{EstimateConfidence.HIGH}')",
            name="chk_estimates_confidence",
        ),
        Index("ix_estimates_service_estimated", "service_id", "estimated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    service_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True
    )
    estimated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lower_minutes: Mapped[float] = mapped_column(Float, nullable=False)
    upper_minutes: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[str] = mapped_column(String(20), nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    data_freshness_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    supporting_signals: Mapped[dict[str, Any]] = mapped_column(
        JsonType, nullable=False, default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    service: Mapped["Service"] = relationship("Service", back_populates="estimates")
