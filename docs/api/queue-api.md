# QueueLess Bharat API Specification (Milestone 3 Production Hardened)

> **Base URL:** `/api/v1`  
> **Protocol:** HTTP/1.1 REST  
> **Content-Type:** `application/json`

---

## 1. Overview & Error Semantics

The QueueLess Bharat API provides clean RESTful interfaces for catalog management, queue lifecycle operations, citizen wait observations, and deterministic wait-time projections.

### Standard HTTP Status Codes

| Code | Status | Meaning in QueueLess Bharat |
| :--- | :--- | :--- |
| **`200 OK`** | Success | Query returned or mutation processed successfully |
| **`201 Created`** | Created | Entity created successfully |
| **`400 Bad Request`** | Invalid Transition | Business invariant or state machine transition rejected |
| **`404 Not Found`** | Not Found | Target entity (Location, Service, Counter, QueueSession) not found |
| **`409 Conflict`** | Conflict | Duplicate idempotency key used for a conflicting action |
| **`422 Unprocessable`**| Validation Error | Malformed request body or schema validation violation |
| **`503 Unavailable`** | Unavailable | Dependent system unavailable |

Database exceptions are never leaked directly to API clients.

---

## 2. Locations API

### Create Location
- **Endpoint:** `POST /api/v1/locations`
- **Status:** `201 Created`
- **Request Body:**
```json
{
  "name": "District Hospital Civil Lines",
  "category": "hospital",
  "address": "Civil Lines Ward 4",
  "city": "Bhopal",
  "state": "Madhya Pradesh",
  "timezone": "Asia/Kolkata",
  "latitude": 23.2599,
  "longitude": 77.4126,
  "status": "active"
}
```
*Categories supported:* `hospital`, `rto`, `government_office`.

### List Locations
- **Endpoint:** `GET /api/v1/locations`
- **Status:** `200 OK`
- **Response:** Array of Location objects.

### Get Location
- **Endpoint:** `GET /api/v1/locations/{location_id}`
- **Status:** `200 OK` (or `404 Not Found`)

---

## 3. Services API

### Create Service
- **Endpoint:** `POST /api/v1/services`
- **Status:** `201 Created`
- **Request Body:**
```json
{
  "location_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "OPD Registration",
  "description": "General Patient Intake Counter",
  "status": "active"
}
```

### List Services
- **Endpoint:** `GET /api/v1/services?location_id={location_id}`
- **Status:** `200 OK`
- **Query Parameters:** `location_id` (optional filter).

### Get Service Details
- **Endpoint:** `GET /api/v1/services/{service_id}`
- **Status:** `200 OK` (or `404 Not Found`)

### Get Service Queue Status & Estimate
- **Endpoint:** `GET /api/v1/services/{service_id}/queue-status`
- **Status:** `200 OK` (or `404 Not Found`)
- **Response Body (When Estimate is Available):**
```json
{
  "service": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "location_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "OPD Registration",
    "description": "General Patient Intake Counter",
    "status": "active",
    "created_at": "2026-10-07T10:00:00Z",
    "updated_at": "2026-10-07T10:00:00Z"
  },
  "queue_state": {
    "waiting_count": 8,
    "in_service_count": 2,
    "active_counters": 2
  },
  "people_ahead": 8,
  "active_counters": 2,
  "estimated_wait": {
    "is_available": true,
    "lower_minutes": 16.5,
    "upper_minutes": 23.5,
    "expected_minutes": 20.0,
    "confidence": "HIGH",
    "sample_size": 12,
    "freshness_seconds": 180,
    "model_version": "v1-deterministic",
    "reason": null,
    "supporting_signals": {
      "avg_service_time_minutes": 5.0,
      "service_rate_per_hour": 24.0,
      "coefficient_of_variation": 0.08,
      "data_freshness_seconds": 180
    }
  }
}
```
- **Response Body (When Estimate is Unavailable):**
```json
{
  "service": { ... },
  "queue_state": {
    "waiting_count": 5,
    "in_service_count": 0,
    "active_counters": 0
  },
  "people_ahead": 5,
  "active_counters": 0,
  "estimated_wait": {
    "is_available": false,
    "lower_minutes": null,
    "upper_minutes": null,
    "expected_minutes": null,
    "confidence": null,
    "sample_size": 0,
    "freshness_seconds": 0,
    "model_version": "v1-deterministic",
    "reason": "No active counters available to serve waiting queue"
  }
}
```
*Critical Invariant:* When an estimate cannot be computed, `is_available` is `false` and bounds are `null`. The system **never** returns `0 minutes` for an unestimable queue.

### Submit Observation
- **Endpoint:** `POST /api/v1/services/{service_id}/observations`
- **Status:** `201 Created`
- **Request Body:**
```json
{
  "people_ahead": 14,
  "reported_wait_minutes": 30.0,
  "active_counters": 2,
  "source": "USER_REPORTED"
}
```
*Validation:* `people_ahead >= 0`, `active_counters >= 0`, `reported_wait_minutes >= 0` (or null).

---

## 4. Counters API

### Create Counter
- **Endpoint:** `POST /api/v1/counters`
- **Status:** `201 Created`
- **Request Body:**
```json
{
  "service_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Counter 1 - Fee Deposit",
  "status": "active"
}
```

### List Counters
- **Endpoint:** `GET /api/v1/counters?service_id={service_id}`
- **Status:** `200 OK`

---

## 5. Queue Lifecycle API & Idempotency

### Check In to Queue
- **Endpoint:** `POST /api/v1/queue/check-in`
- **Status:** `201 Created`
- **Request Body:**
```json
{
  "service_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "citizen_987",
  "idempotency_key": "chk_xyz_12345"
}
```
- **Idempotency Behavior:** If a request with an existing `idempotency_key` is submitted, the API returns the previously created `QueueSession` without duplicating records or queue position.

### Get Queue Session
- **Endpoint:** `GET /api/v1/queue/{session_id}`
- **Status:** `200 OK` (or `404 Not Found`)

### Start Service
- **Endpoint:** `POST /api/v1/queue/{session_id}/start`
- **Status:** `200 OK`
- **Request Body:**
```json
{
  "counter_id": "c1d2e3f4-a5b6-7890-1234-56789abcdef0",
  "idempotency_key": "start_xyz_12345"
}
```
- **Allowed Transition:** `WAITING` $\rightarrow$ `IN_SERVICE`.
- **Side Effect:** Automatically creates a `ServiceSession` tracking physical throughput.
- **Errors:** `400 Bad Request` if current status is not `WAITING`.

### Complete Service
- **Endpoint:** `POST /api/v1/queue/{session_id}/complete`
- **Status:** `200 OK`
- **Request Body:**
```json
{
  "idempotency_key": "comp_xyz_12345"
}
```
- **Allowed Transition:** `IN_SERVICE` $\rightarrow$ `COMPLETED`.
- **Side Effect:** Automatically closes the `ServiceSession` and calculates elapsed duration in seconds.
- **Errors:** `400 Bad Request` if current status is not `IN_SERVICE`.

### Cancel Queue Session
- **Endpoint:** `POST /api/v1/queue/{session_id}/cancel`
- **Status:** `200 OK`
- **Request Body:**
```json
{
  "reason": "Citizen left waiting hall",
  "idempotency_key": "cncl_xyz_12345"
}
```
- **Allowed Transition:** `WAITING` $\rightarrow$ `CANCELLED`.
- **Errors:** `400 Bad Request` if current status is not `WAITING`.

---

## 6. User-Centric Queue Status & Live Polling

### Get User Queue Status
- **Endpoint:** `GET /api/v1/queue/{session_id}/status`
- **Status:** `200 OK` (or `404 Not Found`)
- **Description:** Returns real-time user-centric status including the participant's exact 1-based position in line, the count of participants strictly ahead in FIFO order, aggregate facility metrics, and a personalized deterministic wait-time estimate.
- **Response Body:**
```json
{
  "session": {
    "id": "7b38b7ed-5db5-4683-8a99-455c21425689",
    "service_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "citizen_42",
    "status": "WAITING",
    "checked_in_at": "2026-10-07T10:00:00Z",
    "service_started_at": null,
    "completed_at": null,
    "cancelled_at": null,
    "created_at": "2026-10-07T10:00:00Z",
    "updated_at": "2026-10-07T10:00:00Z"
  },
  "service": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "location_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "OPD Registration",
    "description": "General Patient Intake Counter",
    "status": "active",
    "created_at": "2026-10-07T09:00:00Z",
    "updated_at": "2026-10-07T09:00:00Z"
  },
  "position": 3,
  "people_ahead": 2,
  "queue_state": {
    "waiting_count": 5,
    "in_service_count": 2,
    "active_counters": 2
  },
  "estimated_wait": {
    "is_available": true,
    "lower_minutes": 10.0,
    "upper_minutes": 16.0,
    "expected_minutes": 12.5,
    "confidence": "HIGH",
    "sample_size": 18,
    "freshness_seconds": 25,
    "model_version": "v1-deterministic",
    "reason": null,
    "supporting_signals": {
      "arrival_rate_per_min": 0.45,
      "service_rate_per_min": 0.35,
      "iqr_outliers_rejected": 1
    }
  }
}
```

#### Line Position Semantics
- `WAITING`: `position` is a 1-based positive integer strictly evaluated by `checked_in_at` (FIFO) and tie-broken by session `id`. `people_ahead` = `position - 1`.
- `IN_SERVICE`: `position` is `null`, `people_ahead` is `0`, with `estimated_wait` marked as currently being served (`0.0` minutes).
- `COMPLETED` / `CANCELLED`: `position` is `null`, `people_ahead` is `0`, `estimated_wait` is unavailable (`is_available: false`).

---

## 7. Production Hardening Guarantees (Milestone 3)

1. **Input Normalization & Boundary Checks:**
   - All string inputs (names, addresses, cities, states, user IDs, reasons) automatically strip leading and trailing whitespace.
   - Pydantic models reject empty strings or whitespace-only inputs for required fields (`min_length=1`).
2. **Active Status Preconditions:**
   - Attempting to check in to an inactive service returns `400 Bad Request`.
   - Attempting to start service using an inactive or maintenance counter returns `400 Bad Request`.
3. **Deterministic Zero-Fabrication Invariant:**
   - Wait times are strictly mathematical (ADR-0003 Little's Law / empirical throughput).
   - If active counters are zero, or historical completions are fewer than minimum sample threshold, `is_available` returns `false` with explicit `reason`.
   - Zero-minute wait times are never fabricated for unestimable queues.
4. **Terminal State Immutability:**
   - `COMPLETED` and `CANCELLED` are immutable terminal states; transitions out of terminal states are strictly rejected (`400 Bad Request`).
5. **Idempotency Deduplication:**
   - Idempotency keys protect against network retries and duplicate operations across check-in, start-service, complete-service, and cancellation.
