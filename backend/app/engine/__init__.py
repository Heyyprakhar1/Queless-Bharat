"""Deterministic queue estimation engine interface.

Authoritative numerical source of truth for wait-time predictions,
confidence intervals, and data freshness metrics. Algorithmic calculation
logic will be implemented in subsequent milestones per ADR-0003.
"""

from typing import Protocol, runtime_checkable


@runtime_checkable
class QueueEstimator(Protocol):
    """Protocol boundary for deterministic queue estimation implementations."""

    pass
