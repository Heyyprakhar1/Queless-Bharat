"""Domain layer package.

Houses core business entities, domain invariants, and domain-level exceptions.
"""

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
from app.domain.exceptions import (
    DomainError,
    DuplicateIdempotencyKeyError,
    EstimationUnavailableError,
    InvalidStateTransitionError,
    ResourceNotFoundError,
)
from app.domain.models import (
    Counter,
    Estimate,
    Location,
    QueueEvent,
    QueueSession,
    Service,
    ServiceSession,
    User,
    WaitObservation,
)

__all__ = [
    "Counter",
    "CounterStatus",
    "DomainError",
    "DuplicateIdempotencyKeyError",
    "Estimate",
    "EstimateConfidence",
    "EstimationUnavailableError",
    "InvalidStateTransitionError",
    "Location",
    "LocationCategory",
    "LocationStatus",
    "ObservationSource",
    "QueueEvent",
    "QueueEventType",
    "QueueSession",
    "QueueSessionStatus",
    "ResourceNotFoundError",
    "Service",
    "ServiceSession",
    "ServiceStatus",
    "User",
    "UserRole",
    "WaitObservation",
]
