"""Comprehensive deterministic unit tests for Queue Estimator V1.

Tests cover all 18 matrix scenarios:
1. zero people ahead
2. one person ahead
3. large queue
4. one active counter
5. multiple active counters
6. zero active counters
7. no completed service sessions
8. insufficient sample size
9. fresh observations
10. stale observations
11. stable throughput
12. highly variable throughput
13. outlier service duration
14. invalid negative values
15. deterministic repeatability
16. confidence transitions
17. lower bound never exceeds upper bound
18. estimate never produces negative wait time
"""

import pytest

from app.domain.enums import EstimateConfidence
from app.engine.estimator import (
    MODEL_VERSION,
    DeterministicQueueEstimator,
    EstimatorInput,
)


@pytest.fixture
def estimator() -> DeterministicQueueEstimator:
    return DeterministicQueueEstimator()


# Standard baseline durations: 10 sessions around 300 seconds (5 minutes)
STANDARD_DURATIONS = [290.0, 310.0, 305.0, 295.0, 300.0, 302.0, 298.0, 312.0, 301.0, 297.0]


class TestQueueEstimatorMatrix:
    """Test suite covering the complete 18-scenario verification matrix."""

    # 1. Zero people ahead
    def test_01_zero_people_ahead(self, estimator: DeterministicQueueEstimator):
        inp = EstimatorInput(
            people_ahead=0,
            active_counters=2,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=60,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        assert res.lower_minutes == 0.0
        assert res.upper_minutes == 0.0
        assert res.expected_minutes == 0.0
        assert res.confidence == EstimateConfidence.HIGH

    # 2. One person ahead
    def test_02_one_person_ahead(self, estimator: DeterministicQueueEstimator):
        inp = EstimatorInput(
            people_ahead=1,
            active_counters=1,
            completed_service_durations_seconds=STANDARD_DURATIONS,  # avg ~5 mins
            data_freshness_seconds=120,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        assert res.expected_minutes is not None
        assert 4.0 <= res.expected_minutes <= 6.0
        assert res.lower_minutes <= res.expected_minutes <= res.upper_minutes

    # 3. Large queue
    def test_03_large_queue(self, estimator: DeterministicQueueEstimator):
        # 5 min avg -> 100 people / (2 counters / 5 min) = 250 mins
        inp = EstimatorInput(
            people_ahead=100,
            active_counters=2,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=300,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        assert res.expected_minutes == pytest.approx(250.0, rel=0.05)
        assert res.lower_minutes < res.upper_minutes

    # 4. One active counter
    def test_04_one_active_counter(self, estimator: DeterministicQueueEstimator):
        inp = EstimatorInput(
            people_ahead=10,
            active_counters=1,
            completed_service_durations_seconds=STANDARD_DURATIONS,  # ~5 min avg -> 50 mins
            data_freshness_seconds=100,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        assert res.expected_minutes == pytest.approx(50.0, rel=0.05)

    # 5. Multiple active counters
    def test_05_multiple_active_counters(self, estimator: DeterministicQueueEstimator):
        inp1 = EstimatorInput(
            people_ahead=20,
            active_counters=1,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=100,
        )
        inp4 = EstimatorInput(
            people_ahead=20,
            active_counters=4,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=100,
        )
        res1 = estimator.estimate(inp1)
        res4 = estimator.estimate(inp4)
        assert res1.is_available and res4.is_available
        # With 4 counters, expected wait should be roughly 1/4th of 1 counter
        assert res4.expected_minutes == pytest.approx(res1.expected_minutes / 4.0, rel=0.05)

    # 6. Zero active counters
    def test_06_zero_active_counters(self, estimator: DeterministicQueueEstimator):
        inp_queue = EstimatorInput(
            people_ahead=5,
            active_counters=0,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=60,
        )
        res = estimator.estimate(inp_queue)
        assert res.is_available is False
        assert "No active counters" in (res.reason or "")

        # Also zero active counters with zero people ahead
        inp_empty = EstimatorInput(
            people_ahead=0,
            active_counters=0,
            completed_service_durations_seconds=STANDARD_DURATIONS,
        )
        res_empty = estimator.estimate(inp_empty)
        assert res_empty.is_available is False

    # 7. No completed service sessions
    def test_07_no_completed_service_sessions(self, estimator: DeterministicQueueEstimator):
        inp = EstimatorInput(
            people_ahead=5,
            active_counters=2,
            completed_service_durations_seconds=[],
            data_freshness_seconds=60,
        )
        res = estimator.estimate(inp)
        assert res.is_available is False
        assert "Insufficient sample data" in (res.reason or "")
        assert res.sample_size == 0

    # 8. Insufficient sample size / Low confidence on sparse data
    def test_08_insufficient_sample_size_confidence(self, estimator: DeterministicQueueEstimator):
        inp = EstimatorInput(
            people_ahead=4,
            active_counters=1,
            completed_service_durations_seconds=[300.0],  # only 1 sample
            data_freshness_seconds=300,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        assert res.sample_size == 1
        assert res.confidence == EstimateConfidence.LOW

    # 9. Fresh observations
    def test_09_fresh_observations(self, estimator: DeterministicQueueEstimator):
        inp = EstimatorInput(
            people_ahead=10,
            active_counters=2,
            completed_service_durations_seconds=STANDARD_DURATIONS,  # 10 samples
            data_freshness_seconds=120,  # 2 minutes fresh (< 900s)
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        assert res.confidence == EstimateConfidence.HIGH
        assert res.data_freshness_seconds == 120

    # 10. Stale observations
    def test_10_stale_observations(self, estimator: DeterministicQueueEstimator):
        inp_fresh = EstimatorInput(
            people_ahead=10,
            active_counters=2,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=120,
        )
        inp_stale = EstimatorInput(
            people_ahead=10,
            active_counters=2,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=3600,  # 1 hour stale
        )
        res_fresh = estimator.estimate(inp_fresh)
        res_stale = estimator.estimate(inp_stale)
        assert res_fresh.is_available and res_stale.is_available
        # Confidence must degrade on stale data
        assert res_fresh.confidence == EstimateConfidence.HIGH
        assert res_stale.confidence == EstimateConfidence.LOW
        # Range should widen for stale data
        range_fresh = res_fresh.upper_minutes - res_fresh.lower_minutes
        range_stale = res_stale.upper_minutes - res_stale.lower_minutes
        assert range_stale >= range_fresh

    # 11. Stable throughput
    def test_11_stable_throughput(self, estimator: DeterministicQueueEstimator):
        # Durations with very low variation
        stable_durations = [300.0, 301.0, 299.0, 300.0, 302.0, 298.0, 300.0, 301.0]
        inp = EstimatorInput(
            people_ahead=10,
            active_counters=2,
            completed_service_durations_seconds=stable_durations,
            data_freshness_seconds=180,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        assert res.confidence == EstimateConfidence.HIGH
        assert res.supporting_signals["coefficient_of_variation"] < 0.1

    # 12. Highly variable throughput
    def test_12_highly_variable_throughput(self, estimator: DeterministicQueueEstimator):
        # High variance durations (from 1 min to 20 mins)
        variable_durations = [60.0, 600.0, 1200.0, 180.0, 900.0, 240.0, 1100.0, 150.0]
        inp = EstimatorInput(
            people_ahead=10,
            active_counters=2,
            completed_service_durations_seconds=variable_durations,
            data_freshness_seconds=180,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        # CV should be high and confidence should not be HIGH
        assert res.confidence in (EstimateConfidence.MEDIUM, EstimateConfidence.LOW)
        assert res.upper_minutes - res.lower_minutes > 5.0

    # 13. Outlier service duration handling
    def test_13_outlier_service_duration(self, estimator: DeterministicQueueEstimator):
        # Durations with an extreme anomaly (e.g., 3600s / 1 hour outlier among ~300s sessions)
        durations_with_outlier = [
            300.0,
            305.0,
            295.0,
            310.0,
            302.0,
            298.0,
            300.0,
            304.0,
            3600.0,  # extreme outlier
        ]
        inp = EstimatorInput(
            people_ahead=10,
            active_counters=1,
            completed_service_durations_seconds=durations_with_outlier,
            data_freshness_seconds=100,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        # Outlier should have been filtered by IQR
        assert res.supporting_signals["outliers_removed"] >= 1
        # Expected wait should remain close to ~50 mins (10 * 5 mins),
        # not inflated by the 1-hour session
        assert res.expected_minutes < 75.0

    # 14. Invalid negative values rejection
    def test_14_invalid_negative_values(self):
        with pytest.raises(ValueError, match="people_ahead must be non-negative"):
            EstimatorInput(people_ahead=-1, active_counters=1)

        with pytest.raises(ValueError, match="active_counters must be non-negative"):
            EstimatorInput(people_ahead=5, active_counters=-1)

        with pytest.raises(ValueError, match="data_freshness_seconds must be non-negative"):
            EstimatorInput(people_ahead=5, active_counters=1, data_freshness_seconds=-10)

        with pytest.raises(ValueError, match="service duration must be non-negative"):
            EstimatorInput(
                people_ahead=5,
                active_counters=1,
                completed_service_durations_seconds=[-50.0],
            )

    # 15. Deterministic repeatability
    def test_15_deterministic_repeatability(self, estimator: DeterministicQueueEstimator):
        inp = EstimatorInput(
            people_ahead=15,
            active_counters=3,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=450,
        )
        res1 = estimator.estimate(inp)
        res2 = estimator.estimate(inp)
        assert res1 == res2
        assert res1.lower_minutes == res2.lower_minutes
        assert res1.upper_minutes == res2.upper_minutes
        assert res1.expected_minutes == res2.expected_minutes
        assert res1.confidence == res2.confidence

    # 16. Confidence transitions
    def test_16_confidence_transitions(self, estimator: DeterministicQueueEstimator):
        # 1 sample -> LOW
        inp_low = EstimatorInput(
            people_ahead=5,
            active_counters=1,
            completed_service_durations_seconds=[300.0],
            data_freshness_seconds=200,
        )
        assert estimator.estimate(inp_low).confidence == EstimateConfidence.LOW

        # 4 samples, fresh -> MEDIUM
        inp_med = EstimatorInput(
            people_ahead=5,
            active_counters=1,
            completed_service_durations_seconds=[290.0, 310.0, 305.0, 295.0],
            data_freshness_seconds=600,
        )
        assert estimator.estimate(inp_med).confidence == EstimateConfidence.MEDIUM

        # 10 samples, fresh, low variance -> HIGH
        inp_high = EstimatorInput(
            people_ahead=5,
            active_counters=1,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=300,
        )
        assert estimator.estimate(inp_high).confidence == EstimateConfidence.HIGH

    # 17. Lower bound never exceeds upper bound
    @pytest.mark.parametrize(
        ("people", "counters", "freshness"),
        [
            (0, 2, 0),
            (1, 1, 100),
            (5, 2, 500),
            (25, 3, 2000),
            (150, 5, 8000),
        ],
    )
    def test_17_lower_bound_never_exceeds_upper_bound(
        self, estimator: DeterministicQueueEstimator, people: int, counters: int, freshness: int
    ):
        inp = EstimatorInput(
            people_ahead=people,
            active_counters=counters,
            completed_service_durations_seconds=STANDARD_DURATIONS,
            data_freshness_seconds=freshness,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        assert res.lower_minutes <= res.upper_minutes

    # 18. Estimate never produces negative wait time
    @pytest.mark.parametrize(
        ("people", "counters", "durations"),
        [
            (0, 1, STANDARD_DURATIONS),
            (1, 10, [15.0, 20.0, 18.0, 22.0]),  # very fast service
            (2, 5, [60.0, 70.0, 65.0]),
        ],
    )
    def test_18_estimate_never_produces_negative_wait(
        self,
        estimator: DeterministicQueueEstimator,
        people: int,
        counters: int,
        durations: list[float],
    ):
        inp = EstimatorInput(
            people_ahead=people,
            active_counters=counters,
            completed_service_durations_seconds=durations,
            data_freshness_seconds=0,
        )
        res = estimator.estimate(inp)
        assert res.is_available is True
        assert res.lower_minutes >= 0.0
        assert res.upper_minutes >= 0.0
        assert res.expected_minutes >= 0.0

    def test_model_version(self, estimator: DeterministicQueueEstimator):
        assert estimator.model_version == MODEL_VERSION
