# Queue Estimation Engine Specification (v1-deterministic)

> **Status:** Accepted / Active Specification  
> **Model Version:** `v1-deterministic`  
> **Architecture Reference:** ADR-0003 (Deterministic Queue Estimation), ADR-0004 (AI Isolation)

---

## 1. Overview & Architectural Principles

QueueLess Bharat mandates that all numerical wait-time predictions are calculated strictly by **deterministic, mathematically verifiable application logic** residing in the Queue Engine.

### Core Non-Negotiables:
1. **Zero Stochastic / AI Dependency:** AI models (LLMs, neural networks) are strictly excluded from calculating wait times, confidence scores, bounds, or overriding mathematical results.
2. **Deterministic Repeatability:** For identical inputs, the engine produces identical numerical outputs.
3. **Honest Uncertainty Over False Precision:** Predictions are provided as bounded confidence intervals $[L, U]$ rather than single point values (e.g., "12 to 20 minutes", not "14.3 minutes").
4. **Explicit Insufficient-Data State:** If empirical data is absent or inadequate, the engine explicitly reports that an estimate is unavailable rather than fabricating arbitrary numbers or returning a misleading "0 minutes".
5. **Pure, Independent Interface:** The estimation module depends neither on database drivers nor on web/HTTP frameworks, allowing direct, isolated unit testing.

---

## 2. Estimator Inputs

The estimator consumes the `EstimatorInput` data structure:

| Parameter | Type | Validation Invariant | Description |
| :--- | :--- | :--- | :--- |
| `people_ahead` | `int` | $\ge 0$ | Number of participants currently waiting in line |
| `active_counters` | `int` | $\ge 0$ | Number of currently active service windows |
| `completed_service_durations_seconds` | `list[float]` | Each item $\ge 0$ | Observed durations of recently completed service sessions |
| `data_freshness_seconds` | `int` | $\ge 0$ | Elapsed seconds since the most recent observation or completion |
| `observation_wait_minutes` | `float \| None` | $\ge 0$ if present | Optional reported wait from recent citizen observation |

Negative values for any input parameter raise an immediate validation `ValueError`.

---

## 3. Insufficient-Data & Special State Handling

Before statistical calculations begin, the engine evaluates boundary conditions:

### Case 1: Empty Queue with Open Counters ($N = 0$, $C > 0$)
- **Condition:** Citizen arrives with nobody ahead and at least one counter active.
- **Result:** Immediate service available.
  - $\text{lower\_minutes} = 0.0$
  - $\text{upper\_minutes} = 0.0$
  - $\text{expected\_minutes} = 0.0$
  - $\text{confidence} = \text{HIGH}$

### Case 2: Zero Active Counters ($C = 0$)
- **Condition:** No service windows are staffed or active.
- **Result:** Estimate unavailable (`is_available = False`).
  - Reason: `"No active counters available to serve waiting queue"`.
  - The queue is stalled; projecting a wait time would mislead citizens.

### Case 3: Zero Completed Service Sessions ($K = 0$)
- **Condition:** No completed session throughput data exists for this service.
- **Result:** Estimate unavailable (`is_available = False`).
  - Reason: `"Insufficient sample data: no completed service sessions recorded"`.
  - The engine never invents a baseline out of thin air.

---

## 4. Statistical Filtering & Outlier Handling

Real service queues occasionally record extreme anomalies (e.g., an interrupted transaction taking 2 hours, or an accidental 1-second click). When sample size $K \ge 4$, the engine applies **Interquartile Range (IQR)** filtering:

1. **Order samples:** $s_{(1)} \le s_{(2)} \le \dots \le s_{(K)}$
2. **Compute percentiles:**
   $$Q_1 = \text{Percentile}_{25}(s), \quad Q_3 = \text{Percentile}_{75}(s)$$
   $$\text{IQR} = Q_3 - Q_1$$
3. **Fence boundaries:**
   $$\text{Lower Fence} = \max(0, Q_1 - 1.5 \times \text{IQR})$$
   $$\text{Upper Fence} = Q_3 + 1.5 \times \text{IQR}$$
4. **Filter samples:**
   $$S_{\text{valid}} = \{ s \in S \mid \text{Lower Fence} \le s \le \text{Upper Fence} \}$$
   If all samples fall outside (degenerate distribution), $S_{\text{valid}}$ defaults to $S$.

When $K < 4$, all samples are retained ($S_{\text{valid}} = S$).

---

## 5. Throughput & Base Wait Time Calculation

Let $k = |S_{\text{valid}}|$ be the count of filtered duration samples:

1. **Mean Service Duration:**
   $$\bar{T}_{\text{sec}} = \frac{1}{k} \sum_{i=1}^{k} s_i, \quad T_{\text{avg}} = \frac{\bar{T}_{\text{sec}}}{60.0} \quad (\text{minutes})$$
   A floor of $T_{\text{avg}} \ge 0.2$ minutes (12 seconds) is enforced to avoid division anomalies.

2. **Standard Deviation:**
   For $k > 1$:
   $$\sigma_{\text{sec}} = \sqrt{\frac{1}{k - 1} \sum_{i=1}^{k} (s_i - \bar{T}_{\text{sec}})^2}, \quad \sigma_{\text{min}} = \frac{\sigma_{\text{sec}}}{60.0}$$
   For $k = 1$, standard deviation defaults to an assumed $25\%$ variance: $\sigma_{\text{min}} = 0.25 \times T_{\text{avg}}$.

3. **Effective Queue Service Rate:**
   Across $C$ active physical counters, the collective throughput rate $R$ (citizens served per minute) is:
   $$R = \frac{C}{T_{\text{avg}}}$$

4. **Expected Wait Time ($W$):**
   Using Little's Law variation for waiting queue length $N$:
   $$W = \frac{N}{R} = N \times \frac{T_{\text{avg}}}{C} \quad (\text{minutes})$$

---

## 6. Uncertainty & Range Bounds Calculation

The prediction range $[L, U]$ reflects statistical variance, sample size scarcity, and data staleness:

1. **Coefficient of Variation ($CV$):**
   $$CV = \frac{\sigma_{\text{min}}}{T_{\text{avg}}}$$
   Base spread factor $m$ is bounded between $15\%$ and $60\%$:
   $$m = \max(0.15, \min(CV, 0.60))$$

2. **Sample Size Penalty Factor ($f_{\text{sample}}$):**
   Smaller sample sizes widen the range to communicate uncertainty:
   $$f_{\text{sample}} = 1.0 + \max\left(0.0, \frac{10 - k}{20.0}\right)$$
   *(e.g., $f_{\text{sample}} = 1.45$ for $k=1$, decreasing to $1.0$ for $k \ge 10$)*

3. **Freshness Penalty Factor ($f_{\text{fresh}}$):**
   Data older than 15 minutes ($900\text{s}$) incurs a linear penalty, capped at $2.0$:
   $$f_{\text{fresh}} = \min\left(2.0, 1.0 + \max\left(0.0, \frac{\text{freshness\_sec} - 900}{3600.0}\right)\right)$$

4. **Combined Uncertainty Margin ($\Delta$):**
   $$U = m \times f_{\text{sample}} \times f_{\text{fresh}}$$
   $$\Delta = \max(1.0, U \times W)$$

5. **Final Interval Bounds:**
   $$L = \max(0.0, \text{round}(W - \Delta, 1))$$
   $$U = \max(L, \text{round}(W + \Delta, 1))$$

### Guaranteed Invariants:
- $0.0 \le L \le W \le U$
- Lower bound never exceeds upper bound.
- Wait time is never negative.

---

## 7. Deterministic Confidence Classification

Confidence is classified into three explicit tiers:

| Confidence | Sample Size ($k$) | Freshness ($\tau$) | Coefficient of Variation ($CV$) |
| :--- | :--- | :--- | :--- |
| **`HIGH`** | $k \ge 8$ | $\tau \le 900\text{s}$ (15 min) | $CV \le 0.40$ (stable throughput) |
| **`MEDIUM`** | $k \ge 3$ | $\tau \le 2700\text{s}$ (45 min) | $CV \le 0.70$ |
| **`LOW`** | $k < 3$ OR $\tau > 2700\text{s}$ OR $CV > 0.70$ | Any valid data | Any variance |

If $\tau > 7200\text{s}$ (2 hours), confidence degrades to `LOW` regardless of sample size.

---

## 8. Concrete Examples

### Example A: OPD Registration (Stable, High Confidence)
- **Inputs:** $N = 10$, $C = 2$ counters.
- **Durations:** 10 sessions averaging 300s (5.0 min), $\sigma = 15\text{s}$ ($0.25$ min).
- **Freshness:** $120\text{s}$ (2 min).
- **Calculations:**
  - $T_{\text{avg}} = 5.0$ min
  - $R = 2 / 5.0 = 0.4$ citizens/min
  - $W = 10 \times (5.0 / 2) = 25.0$ minutes
  - $CV = 0.25 / 5.0 = 0.05 \implies m = 0.15$
  - $f_{\text{sample}} = 1.0$, $f_{\text{fresh}} = 1.0 \implies U = 0.15$
  - $\Delta = \max(1.0, 0.15 \times 25.0) = 3.75$ minutes
  - **Lower Bound:** $21.3$ minutes
  - **Upper Bound:** $28.8$ minutes
  - **Confidence:** `HIGH`

### Example B: Cold Start / Morning Opening (Insufficient Data)
- **Inputs:** $N = 6$, $C = 1$ counter, $K = 0$ completed sessions.
- **Result:**
  - `is_available: false`
  - `reason: "Insufficient sample data: no completed service sessions recorded"`
  - `confidence: null`
  - Client displays: "Estimate Unavailable: Awaiting opening session throughput".

---

## 9. Model Evolution & Versioning

The estimator version is tagged `v1-deterministic` across all outputs and database records. Any future mathematical refinements (such as time-of-day seasonal weights in Milestone 3+) must introduce a new version string (e.g., `v2-deterministic`) and preserve backward-compatible test fixtures.
