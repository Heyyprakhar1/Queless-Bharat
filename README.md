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

> [!NOTE]
> **Explicit Non-Claims:**
> - AWS Cloud production deployment is not yet executed (architecture designs exist; live cloud deployment is deferred).
> - Live external facility telemetry integrations do not exist.
> - Production deployment is not complete.
> - Trivy vulnerability scanning operates as an informational security gate, not an automated release blocker.

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

# Run Playwright Browser E2E test suites (21 tests)
npx playwright test
```

Default local dev ports:
- **Frontend Vite Server:** `http://localhost:5173`
- **Backend Server:** `http://localhost:8001`

---

### 4. Automated Testing Suites

- **Backend Pytest Suite:** 75 tests covering unit estimators, transaction rollbacks, API contract hardening, authentication/RBAC, and M6.1 India demo catalog endpoints.
- **Frontend Playwright E2E Suites:** 21 tests covering:
  - `e2e/india-demo-flow.spec.ts`: City &rarr; Facility &rarr; Service cascading flow, Pune showcase, deterministic wait estimate rendering, simulated data banners, and insufficient-data states.
  - `e2e/queue-flow.spec.ts`: End-to-end citizen queue join, polling updates, operator desk lifecycle transitions, and cancellation.
  - `e2e/auth-flow.spec.ts`: Login, registration, token persistence, RBAC role guard enforcement, and BOLA/IDOR prevention.

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
