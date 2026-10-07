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
    "WaitObservation",
]
