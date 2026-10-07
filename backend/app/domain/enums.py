"""Domain enumerations and constrained values for QueueLess Bharat."""

from enum import StrEnum


class UserRole(StrEnum):
    """Platform identity roles."""

    CITIZEN = "CITIZEN"
    OPERATOR = "OPERATOR"
    ADMIN = "ADMIN"


class LocationCategory(StrEnum):
    """Initial MVP civic domains."""

    HOSPITAL = "hospital"
    RTO = "rto"
    GOVERNMENT_OFFICE = "government_office"


class LocationStatus(StrEnum):
    """Operational status of a physical location."""

    ACTIVE = "active"
    INACTIVE = "inactive"


class ServiceStatus(StrEnum):
    """Operational status of a service."""

    ACTIVE = "active"
    INACTIVE = "inactive"


class CounterStatus(StrEnum):
    """Operational status of a physical/logical counter window."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"


class QueueSessionStatus(StrEnum):
    """Lifecycle states of a queue session."""

    WAITING = "WAITING"
    IN_SERVICE = "IN_SERVICE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class QueueEventType(StrEnum):
    """Immutable event types emitted during queue lifecycle transitions."""

    CHECKED_IN = "CHECKED_IN"
    SERVICE_STARTED = "SERVICE_STARTED"
    SERVICE_COMPLETED = "SERVICE_COMPLETED"
    CANCELLED = "CANCELLED"


class ObservationSource(StrEnum):
    """Origin source of a wait-time or crowd observation."""

    SYSTEM = "SYSTEM"
    USER_REPORTED = "USER_REPORTED"


class EstimateConfidence(StrEnum):
    """Deterministic confidence rating of derived wait estimates."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
