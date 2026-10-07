"""Domain-specific exceptions for queue state machines and invariants."""


class DomainError(Exception):
    """Base exception for all domain logic violations."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InvalidStateTransitionError(DomainError):
    """Raised when an illegal queue session transition is attempted."""

    def __init__(self, current_status: str, target_status: str) -> None:
        super().__init__(
            f"Invalid queue session transition from '{current_status}' to '{target_status}'"
        )
        self.current_status = current_status
        self.target_status = target_status


class ResourceNotFoundError(DomainError):
    """Raised when a requested entity does not exist in the domain."""

    def __init__(self, entity_name: str, identifier: str) -> None:
        super().__init__(f"{entity_name} with identifier '{identifier}' was not found")
        self.entity_name = entity_name
        self.identifier = identifier


class DuplicateIdempotencyKeyError(DomainError):
    """Raised when an idempotency key conflict occurs."""

    def __init__(self, idempotency_key: str) -> None:
        super().__init__(f"Idempotency key '{idempotency_key}' has already been processed")
        self.idempotency_key = idempotency_key


class EstimationUnavailableError(DomainError):
    """Raised when an estimate cannot be computed due to insufficient data."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"Queue wait estimate unavailable: {reason}")
        self.reason = reason
