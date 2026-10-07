"""Deterministic queue estimation engine interface and implementation.

Authoritative numerical source of truth for wait-time predictions,
confidence intervals, and data freshness metrics (ADR-0003).
"""

from typing import Protocol, runtime_checkable

from app.engine.estimator import (
    MODEL_VERSION,
    DeterministicQueueEstimator,
    EstimatorInput,
    WaitEstimate,
)


@runtime_checkable
class QueueEstimator(Protocol):
    """Protocol boundary for deterministic queue estimation implementations."""

    def estimate(self, context: EstimatorInput) -> WaitEstimate:
        """Computes a deterministic wait estimate from queue context."""
        ...


__all__ = [
    "MODEL_VERSION",
    "DeterministicQueueEstimator",
    "EstimatorInput",
    "QueueEstimator",
    "WaitEstimate",
]
