# QueueLess Bharat

> *"Making waiting more predictable, not pretending queues don't exist."*

QueueLess Bharat is a queue intelligence platform designed to bring transparency, predictability, and actionable decision support to civic waiting times across public service touchpoints throughout India, including:

- **Hospitals & Healthcare Facilities** (e.g., AIIMS New Delhi, Sassoon General Hospital Pune, KEM Hospital Mumbai)
- **Regional Transport Offices / RTOs** (e.g., Pune MH-12 RTO, Mumbai MH-01 RTO, Bengaluru KA-01 RTO)
- **Municipal Corporations & Civic Centres** (e.g., Pune Municipal Corporation, BMC Mumbai, MCD Delhi)

Instead of offering unrealistic promises of eliminating physical queues entirely, QueueLess Bharat makes waiting predictable through data-driven queue telemetry, bounded wait intervals, empirical throughput modeling, and strict mathematical estimators.

---

## Project Status & Milestone Roadmap

- **Milestone 0: Architecture & Engineering Foundation** — *Complete*
- **Milestone 1: Application Foundation** — FastAPI + PostgreSQL + Alembic + React + Docker — *Complete*
- **Milestone 2: Queue Domain Model & Deterministic Estimator Engine V1** — *Complete*
- **Milestone 3: Production Hardening, Lifecycle State Machine & Playwright Verification** — *Complete*
- **Milestone 4: Identity & RBAC Boundary** — Stateless JWT, User Roles (`CITIZEN`, `OPERATOR`, `ADMIN`), BOLA/IDOR Protection, and Browser E2E Security Suite — *Complete*
- **Milestone 5 / M5.1: Container Packaging, Docker Compose Stack & Release Engineering** — Multi-stage non-root images, Compose orchestration, health-gated readiness, and GitHub Actions CI with Trivy scanning — *Implemented & Verified*
- **Milestone 6.1: India Demo Coverage & Facility Dataset** — 8 Major Cities (Pune Showcase), verified facilities, useful civic services, simulated queue scenarios, and pure deterministic wait projections — *Complete*
- **Milestone 6.1.1: Security, Reliability & Architecture Hardening** — Privilege escalation prevention, pessimistic row-level locking concurrency safety, DB counter precedence, production secret fail-closed enforcement, sliding-window rate limiting, HTTP security headers, and frontend component modularization — *Complete*
- **Milestone 6.2: Google Citizen Authentication (OIDC) & Spatial Civic-Tech Experience** — Google OAuth / OIDC login, 20-city catalog, 3-column spatial layout, platform-wide Dark/Light mode, multilingual foundation (English, Hindi, Marathi), and Indian tricolour & Ashoka Chakra watermark theme — *Complete*

> [!NOTE]
> **Explicit Non-Claims:**
> - AWS Cloud production deployment is not yet executed (architecture designs exist; live cloud deployment is deferred).
> - Live external facility telemetry integrations do not exist.
> - Production deployment is not complete.
> - Trivy vulnerability scanning operates as an informational security gate, not an automated release blocker.
> - Application does not claim complete immunity to sophisticated DDoS attacks; layered defense-in-depth is implemented at the application tier alongside infrastructure protections.

---

## M6.1 — India Demo Coverage & Facility Dataset

QueueLess Bharat features a verified civic dataset covering **8 major Indian metropolitan cities**, with **Pune** spotlighted as the primary showcase city:

1. **Pune** *(Showcase City)*
2. **Mumbai**
3. **Bengaluru**
4. **Chennai**
5. **Kolkata**
6. **Delhi**
7. **Lucknow**
8. **Patna**

### Hierarchical Explorer Flow

$$\text{City} \longrightarrow \text{Facility} \longrightarrow \text{Civic Service} \longrightarrow \text{Queue Status} \longrightarrow \text{Deterministic Wait Estimate}$$

Each city includes representative, verified civic facilities across three primary public domains:
- **Hospital / Healthcare (`hospital`)**
- **Transport / Licensing (`rto`)**
- **Municipal / Civic Office (`government_office`)**

### Data Provenance & Simulation Notice

> [!IMPORTANT]
> **ALL SEEDED QUEUE VALUES ARE DEMO / SIMULATED DATA.**
> Seeded queue lengths, waiting participant counts, active counters, and completed service session histories are generated solely for mathematical algorithmic demonstration and testing. They are **never** presented as live, real-time, current, or actual physical facility telemetry. Both the API responses and the frontend UI explicitly display a **DEMO / SIMULATED DATA** indicator.

### Showcase Scenarios (Pune & Metros)

- **Moderate Queue:** e.g., Pune RTO Driving Licence Renewal (8 waiting, 2 active counters, 12 completed throughput sessions &rarr; High Confidence, expected ~14 mins, bounded interval).
- **Short Queue:** e.g., Pune RTO Learner Licence Test (2 waiting, 2 active counters &rarr; ~2 mins).
- **Long Queue:** e.g., Pune RTO Vehicle Registration (26 waiting, 2 active counters &rarr; ~67 mins).
- **Insufficient-Data Scenario:** e.g., Sassoon General Hospital Radiology & Ultrasound (4 waiting, 1 active counter, 0 completed service sessions &rarr; Estimate unavailable: *"Insufficient sample data: no completed service sessions recorded"*).
- **Halted / Zero Active Counters:** e.g., Pune Municipal Corporation Birth & Death Certificate (5 waiting, 0 active counters &rarr; Estimate unavailable: *"No active counters available to serve waiting queue"*).

---

## M6.1.1 — Security, Reliability & Architecture Hardening

M6.1.1 addresses architectural, concurrency, security, and reliability defects identified during production audits:

### 1. Privilege Escalation Prevention & Secure User Registration
- Public registration (`POST /api/v1/auth/register`) strictly validates incoming payloads via `CitizenRegisterRequest` (`extra="forbid"`) and **unconditionally provisions the `CITIZEN` role**. Arbitrary role assignment, administrative elevation, or service scope injection is forbidden at the schema boundary.
- Privileged account creation (`ADMIN`, `OPERATOR`, `assigned_service_id`) is strictly restricted to authenticated administrators through protected endpoints (`POST /api/v1/auth/admin/users` and `POST /api/v1/admin/users`) requiring `get_current_admin` RBAC authorization.

### 2. Concurrency-Safe Queue State Transitions
- Eliminated read-validate-mutate-commit race conditions across `QueueSession` lifecycle transitions (`start_service`, `complete_service`, `cancel_queue_session`).
- Enforces pessimistic row-level locking via PostgreSQL `SELECT ... FOR UPDATE` with `execution_options(populate_existing=True)` to prevent SQLAlchemy identity map staleness under high concurrency.
- Added active `ServiceSession` duplicate guard ensuring concurrent calls to `start_service` or `complete_service` cannot double-provision or create orphaned sessions.

### 3. Counter & Observation Precedence
- The registered `Counter` table status in PostgreSQL is the authoritative source of truth for active service capacity.
- If registered counters exist and 0 counters are active, effective capacity is strictly 0 and the queue is correctly reported as halted. Stale or fabricated observations cannot resurrect counter capacity.
- External or user-reported observations are only evaluated if 0 counters are registered in the database AND the observation timestamp is fresh ($\le 1800\text{s}$ / 30 minutes).

### 4. Production Secret Fail-Closed Enforcement
- In `staging` and `production` environments, `AUTH_SECRET_KEY` must be configured with a cryptographically strong secret ($\ge 32$ characters) that does not contain default/insecure markers (`dev-`, `insecure`, `secret`, `replace-in-production`). Weak keys fail closed on application startup.
- Container entrypoint (`backend/entrypoint.sh`) enforces `set -e` failure propagation so failed database migrations or seed executions halt container startup visibly rather than continuing degraded.

### 5. Rate Limiting & Abuse Controls
- In-memory sliding window rate limiter (`SlidingWindowRateLimiter`) with microsecond resolution protects sensitive public endpoints:
  - Auth Login (`POST /api/v1/auth/login`)
  - Citizen Registration (`POST /api/v1/auth/register`)
  - Queue Check-in (`POST /api/v1/queue/check-in`)
- Exceeded thresholds return standard `HTTP 429 Too Many Requests` with informative `Retry-After` headers. Limits are dynamically configurable via environment variables (`RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_LOGIN_WINDOW`, etc.).

### 6. Timeouts, Bounded Operations & Security Headers
- Database connection pool configured with explicit timeouts (`pool_timeout=10.0`, `pool_recycle=1800`) preventing thread exhaustion.
- Collection query endpoints enforce upper bounds (`limit <= 100`).
- Frontend API layer utilizes `fetchWithTimeout` with `AbortController` (15-second default timeout) to prevent hung network promises.
- `SecurityHeadersMiddleware` automatically injects `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- Unhandled server exceptions are intercepted by a global exception handler, logging structured request details while returning sanitized 500 error responses without SQL or stack trace leaks.

### 7. Modular Frontend Architecture
- Refactored monolithic `frontend/src/App.tsx` into modular, single-responsibility components in `frontend/src/components/`:
  - `Header.tsx`: Navigation, system status, authenticated user & role badges, quick demo buttons.
  - `IndiaDemoExplorer.tsx`: City &rarr; Facility &rarr; Service cascading selector, facility details, and deterministic wait projection card.
  - `CitizenTokenDesk.tsx`: Token issuance form, live ticket state (`WAITING`, `IN_SERVICE`, `COMPLETED`, `CANCELLED`), personal wait estimate, and cancellation/dismissal controls.
  - `OperatorDesk.tsx`: RBAC-guarded counter staff controls (`startService`, `completeService`).
  - `HealthPanel.tsx`: Live service and database connectivity indicators.
  - `AuthModal.tsx`: Secure modal for login and citizen registration.
  - `Footer.tsx`: Application footer and milestone attribution.

---

## System Architecture

QueueLess Bharat is structured as a **modular monolith** with clean layer boundaries:

- **FastAPI Modular Monolith:** Async REST/OpenAPI backend organized into domain models, schemas, service layers, and route controllers.
- **React 19 + TypeScript Frontend:** Modern Vite SPA utilizing Tailwind CSS for styling, short polling for live telemetry, and zero WebSocket overhead.
- **PostgreSQL 16:** Relational database enforcing ACID integrity, check constraints, foreign keys, and JSONB storage for telemetry events.
- **SQLAlchemy 2.0 & Alembic:** Async ORM sessions with versioned schema migrations.
- **Deterministic Queue Estimator (ADR-0003):** Mathematical estimation engine implementing Little's Law variations, outlier rejection (IQR), bounded uncertainty intervals, freshness penalties, and confidence scoring (`HIGH`, `MEDIUM`, `LOW`). Zero stochastic or AI dependencies in calculations.
- **Stateless JWT & RBAC (ADR-0006):** Cryptographically signed access tokens, Argon2/bcrypt password hashing, role-based authorization (`CITIZEN`, `OPERATOR`, `ADMIN`), and IDOR/BOLA verification.
- **Containerization & CI:** Multi-stage non-root Docker packaging (`queless-backend`, `queless-frontend`), Docker Compose orchestration, and GitHub Actions CI.

---

## Supported Commands

### 1. Docker Compose (Quickstart)

```bash
# Start full reproducible stack (PostgreSQL + Backend + Frontend)
docker compose up -d --build

# Verify container health and status
docker compose ps

# View unified container logs
docker compose logs -f

# Shut down stack
docker compose down
```

Default exposed ports:
- **Frontend SPA:** `http://localhost:80` (or `http://localhost:8080`)
- **Backend API:** `http://localhost:8000/api/v1`
- **Swagger Documentation:** `http://localhost:8000/docs`
- **PostgreSQL:** `localhost:5432`

---

### 2. Local Backend Development

```bash
cd backend

# Apply Alembic database migrations
uv run alembic upgrade head

# Seed India demo dataset (8 cities + test accounts)
uv run python scripts/seed_data.py

# Start local FastAPI development server
uv run uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Run backend automated pytest suite (75 tests)
uv run pytest
```

---

### 3. Local Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start Vite local development server
npm run dev

# Build production bundle with TypeScript type-checking
npm run build

# Run Oxlint static analysis
npm run lint

# Run Playwright Browser E2E test suites (32 tests)
npx playwright test
```

Default local dev ports:
- **Frontend Vite Server:** `http://localhost:5173`
- **Backend Server:** `http://localhost:8001`

---

### 4. Automated Testing Suites

- **Backend Pytest Suite:** 131 tests covering unit estimators, transaction rollbacks, API contract hardening, Google OAuth / OIDC, authentication/RBAC, pessimistic concurrency locking, counter observation precedence, config fail-closed validation, sliding-window rate limiting, and 20-city India demo catalog endpoints.
- **Frontend Playwright E2E Suites:** 32 tests covering:
  - `e2e/india-demo-flow.spec.ts`: City &rarr; Facility &rarr; Service cascading flow, Pune showcase, deterministic wait estimate rendering, simulated data banners, and insufficient-data states.
  - `e2e/queue-flow.spec.ts`: End-to-end citizen queue join, polling updates, operator desk lifecycle transitions, and cancellation.
  - `e2e/auth-flow.spec.ts`: Google Citizen sign-in, login, registration, token persistence, RBAC role guard enforcement, and BOLA/IDOR prevention.
  - `e2e/theme-i18n.spec.ts`: Platform-wide Dark/Light mode toggle, English/Hindi/Marathi translations, language persistence, and mobile viewport controls.
  - `e2e/api-routing.spec.ts`: Same-origin relative `/api/v1` proxying without hardcoded localhost references.

---

## Seeded Demonstration Accounts

For demonstration and testing purposes, the seed script provisions three default roles:

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@queless.gov.in` | `AdminPass123!` | Global administration, facility & service creation |
| **Counter Operator** | `operator@queless.gov.in` | `OperatorPass123!` | Assigned to OPD General Medicine desk; calls & completes sessions |
| **Citizen Participant** | `citizen@queless.gov.in` | `CitizenPass123!` | Public queue participant; joins queues and tracks tickets |

---

## License

QueueLess Bharat &mdash; Civic Technology Initiative for India.
