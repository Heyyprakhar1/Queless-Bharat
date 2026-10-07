"""Deterministic Queue Estimation Engine V1.

Authoritative numerical source of truth for wait-time predictions.
Complies with ADR-0003:
- Fully deterministic and repeatable.
- Zero AI / ML / stochastic dependencies.
- Bounded uncertainty intervals (lower/upper bounds).
- Rigorous confidence scoring and data freshness decay.
- Explicit insufficient-data state.
"""

import math
from dataclasses import dataclass, field
from typing import Any

from app.domain.enums import EstimateConfidence

MODEL_VERSION = "v1-deterministic"


@dataclass(frozen=True)
class EstimatorInput:
    """Input parameters for the deterministic queue estimator."""

    people_ahead: int
    active_counters: int
    completed_service_durations_seconds: list[float] = field(default_factory=list)
    data_freshness_seconds: int = 0
    observation_wait_minutes: float | None = None

    def __post_init__(self) -> None:
        if self.people_ahead < 0:
            raise ValueError(f"people_ahead must be non-negative, got {self.people_ahead}")
        if self.active_counters < 0:
            raise ValueError(f"active_counters must be non-negative, got {self.active_counters}")
        if self.data_freshness_seconds < 0:
            raise ValueError(
                f"data_freshness_seconds must be non-negative, got {self.data_freshness_seconds}"
            )
        for d in self.completed_service_durations_seconds:
            if d < 0:
                raise ValueError(f"service duration must be non-negative, got {d}")


@dataclass(frozen=True)
class WaitEstimate:
    """Deterministic estimation result conveying expectation, bounds, and confidence."""

    is_available: bool
    lower_minutes: float | None = None
    upper_minutes: float | None = None
    expected_minutes: float | None = None
    confidence: EstimateConfidence | None = None
    sample_size: int = 0
    data_freshness_seconds: int | None = None
    model_version: str = MODEL_VERSION
    reason: str | None = None
    supporting_signals: dict[str, Any] = field(default_factory=dict)


def _filter_iqr_outliers(values: list[float]) -> tuple[list[float], int]:
    """Filters statistical outliers using the Interquartile Range (IQR) method.

    Returns:
        tuple[list[float], int]: (filtered_values, outliers_removed_count)
    """
    if len(values) < 4:
        return sorted(values), 0

    sorted_vals = sorted(values)
    n = len(sorted_vals)

    def _percentile(p: float) -> float:
        k = (n - 1) * p
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_vals[int(k)]
        return sorted_vals[int(f)] * (c - k) + sorted_vals[int(c)] * (k - f)

    q1 = _percentile(0.25)
    q3 = _percentile(0.75)
    iqr = q3 - q1

    lower_fence = max(0.0, q1 - 1.5 * iqr)
    upper_fence = q3 + 1.5 * iqr

    filtered = [v for v in sorted_vals if lower_fence <= v <= upper_fence]
    outliers_removed = n - len(filtered)

    # In the rare event all points are filtered, return original sorted values
    if not filtered:
        return sorted_vals, 0

    return filtered, outliers_removed


class DeterministicQueueEstimator:
    """Deterministic wait-time estimator implementing QueueLess Bharat Engine V1."""

    def __init__(self, model_version: str = MODEL_VERSION) -> None:
        self.model_version = model_version

    def estimate(self, context: EstimatorInput) -> WaitEstimate:
        """Computes a deterministic wait estimate from the given queue context.

        Args:
            context: Verified input data including people ahead, counters, and durations.

        Returns:
            WaitEstimate: Bounded estimate or explicit unavailable state.
        """
        people_ahead = context.people_ahead
        active_counters = context.active_counters
        freshness_sec = context.data_freshness_seconds
        durations = context.completed_service_durations_seconds
        sample_size = len(durations)

        # 1. Zero people ahead: immediate availability
        if people_ahead == 0:
            if active_counters > 0:
                return WaitEstimate(
                    is_available=True,
                    lower_minutes=0.0,
                    upper_minutes=0.0,
                    expected_minutes=0.0,
                    confidence=EstimateConfidence.HIGH,
                    sample_size=sample_size,
                    data_freshness_seconds=freshness_sec,
                    model_version=self.model_version,
                    supporting_signals={
                        "people_ahead": 0,
                        "active_counters": active_counters,
                        "status": "queue_empty_counter_open",
                    },
                )
            else:
                return WaitEstimate(
                    is_available=False,
                    reason="No active counters available",
                    sample_size=sample_size,
                    data_freshness_seconds=freshness_sec,
                    model_version=self.model_version,
                    supporting_signals={
                        "people_ahead": 0,
                        "active_counters": 0,
                    },
                )

        # 2. Check for halted queue (people waiting but zero active counters)
        if active_counters == 0:
            return WaitEstimate(
                is_available=False,
                reason="No active counters available to serve waiting queue",
                sample_size=sample_size,
                data_freshness_seconds=freshness_sec,
                model_version=self.model_version,
                supporting_signals={
                    "people_ahead": people_ahead,
                    "active_counters": 0,
                },
            )

        # 3. Insufficient data: no completed service sessions
        if sample_size == 0:
            return WaitEstimate(
                is_available=False,
                reason="Insufficient sample data: no completed service sessions recorded",
                sample_size=0,
                data_freshness_seconds=freshness_sec,
                model_version=self.model_version,
                supporting_signals={
                    "people_ahead": people_ahead,
                    "active_counters": active_counters,
                },
            )

        # 4. Outlier rejection & throughput statistics
        filtered_durations, outliers_count = _filter_iqr_outliers(durations)
        k = len(filtered_durations)
        mean_duration_sec = sum(filtered_durations) / k

        if k > 1:
            variance_sec = sum((x - mean_duration_sec) ** 2 for x in filtered_durations) / (k - 1)
            std_dev_sec = math.sqrt(variance_sec)
        else:
            # Default 25% variance assumption for single sample
            std_dev_sec = mean_duration_sec * 0.25

        avg_service_time_minutes = mean_duration_sec / 60.0
        std_dev_minutes = std_dev_sec / 60.0

        # Avoid zero or near-zero duration pathology
        effective_avg_minutes = max(0.2, avg_service_time_minutes)

        # 5. Base Expected Wait: Little's Law variation
        # effective_rate = active_counters / effective_avg_minutes (people / minute)
        # expected_wait = people_ahead / effective_rate
        expected_wait = people_ahead * (effective_avg_minutes / active_counters)

        # 6. Uncertainty & Range Bounds Calculation
        # Coefficient of variation (CV) measures throughput variability
        cv = (std_dev_minutes / effective_avg_minutes) if effective_avg_minutes > 0 else 0.25
        base_spread = max(0.15, min(cv, 0.60))

        # Sample size discount / penalty: smaller samples widen bounds
        sample_penalty = 1.0 + max(0.0, (10 - sample_size) / 20.0)

        # Freshness penalty: stale observations widen bounds
        # Threshold: 15 minutes (900s) fresh; decay over next 60 minutes
        freshness_penalty = 1.0 + max(0.0, (freshness_sec - 900) / 3600.0)
        freshness_penalty = min(freshness_penalty, 2.0)

        uncertainty_factor = base_spread * sample_penalty * freshness_penalty
        margin = max(1.0, uncertainty_factor * expected_wait)

        lower_bound = max(0.0, round(expected_wait - margin, 1))
        upper_bound = max(lower_bound, round(expected_wait + margin, 1))
        expected_rounded = round(expected_wait, 1)

        # 7. Deterministic Confidence Rating
        # HIGH: >= 8 samples, fresh (<= 900s), stable throughput (CV <= 0.40)
        # MEDIUM: >= 3 samples, moderate freshness (<= 2700s), CV <= 0.70
        # LOW: low sample (< 3) OR stale (> 2700s) OR highly variable throughput
        if sample_size >= 8 and freshness_sec <= 900 and cv <= 0.40:
            confidence = EstimateConfidence.HIGH
        elif sample_size >= 3 and freshness_sec <= 2700 and cv <= 0.70:
            confidence = EstimateConfidence.MEDIUM
        else:
            confidence = EstimateConfidence.LOW

        supporting_signals = {
            "people_ahead": people_ahead,
            "active_counters": active_counters,
            "sample_size_raw": sample_size,
            "sample_size_filtered": k,
            "outliers_removed": outliers_count,
            "avg_service_time_minutes": round(effective_avg_minutes, 2),
            "std_dev_minutes": round(std_dev_minutes, 2),
            "coefficient_of_variation": round(cv, 3),
            "service_rate_per_hour": round((60.0 / effective_avg_minutes) * active_counters, 1),
            "data_freshness_seconds": freshness_sec,
        }

        return WaitEstimate(
            is_available=True,
            lower_minutes=lower_bound,
            upper_minutes=upper_bound,
            expected_minutes=expected_rounded,
            confidence=confidence,
            sample_size=sample_size,
            data_freshness_seconds=freshness_sec,
            model_version=self.model_version,
            supporting_signals=supporting_signals,
        )
