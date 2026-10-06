# ADR-0003: Use Deterministic Queue Estimation as the Numerical Source of Truth

## Status
Accepted

## Context
A central hazard in modern AI-enabled applications is treating stochastic Large Language Models (LLMs) or black-box neural networks as authoritative calculation engines for critical numerical predictions. LLMs are probabilistic token predictors subject to hallucinations, non-deterministic variations, calibration errors, and ungrounded arithmetic.

In public service environments (such as hospital emergency departments, RTO licensing queues, and administrative offices), providing misleading or arbitrary wait-time projections severely degrades public trust. Users make significant real-world decisions—such as taking time off work or traveling across town—based on wait expectations.

Furthermore, real queues have inherent variance: service times fluctuate, complex cases occur, and counters pause for meal breaks. Providing point-in-time predictions with artificial precision (e.g., "Wait time: 42 minutes") creates a false sense of certainty that is almost always incorrect.

## Decision
Numerical wait-time estimates in QueueLess Bharat must be computed exclusively by **deterministic, data-driven application logic** residing in the Queue Engine.

The Queue Engine is the sole numerical source of truth. The mathematical estimation model incorporates explicit signals:
1. **People Ahead in Queue ($N$):** Count of pending tickets or aggregated crowd estimates.
2. **Active Physical Counters ($C$):** Number of open, active service windows currently processing tickets.
3. **Recent Throughput Rate ($\mu_{recent}$):** Rolling average of completed service sessions per hour over the recent operating window (e.g., past 30–60 minutes).
4. **Historical Baseline Service Duration ($\mu_{hist}$):** Baseline empirical service durations for the specific service, time of day, and day of week.
5. **Data Freshness Decay:** A time-weighted decay function that discounts observations as they age.
6. **Sample Size & Signal Density:** Metric reflecting the volume and diversity of supporting data points.

### Communicating Uncertainty Over False Precision
Rather than outputting a single fragile scalar, estimates must provide:
- **Expected Wait:** The deterministic central prediction.
- **Lower Bound & Upper Bound:** A confidence interval (e.g., 30 to 45 minutes) reflecting variance and uncertainty.
- **Confidence Rating:** An explicit qualitative rating (`High`, `Medium`, `Low`) driven by signal freshness and sample size.
- **Freshness Indicator:** The elapsed time since the latest signal update.

## Consequences

### Positive
- **Auditable & Repeatable:** Given the same input signals and parameters, the queue engine produces identical, verifiable outputs.
- **High Reliability:** Calculation runs in microseconds in pure code, incurring zero external LLM API costs or network latency for estimate calculation.
- **Realistic User Expectations:** Bounded estimates and confidence scores protect citizens from false precision and build authentic trust.
- **Zero Hallucination Risk:** Eliminates the risk of an LLM producing absurd predictions (e.g., negative wait times or hallucinatory projections).

### Negative / Tradeoffs
- **Model Tuning:** Requires ongoing refinement of statistical weighting parameters (e.g., blending recent throughput with historical baselines).
- **Cold-Start Handling:** When a new day or service session begins with zero recent throughput, the engine must rely on historical priors and clearly signal lower confidence.
