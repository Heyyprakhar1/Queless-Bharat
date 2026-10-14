# QueuelessBharat

> *"Make waiting more predictable, not pretend queues don't exist."*

QueuelessBharat is an open civic-tech platform designed to bring transparency, predictability, and actionable decision support to citizen waiting times across public service facilities in India—including municipal corporations, regional transport offices (RTOs), and government hospitals.

Instead of making unrealistic claims of eliminating physical lines entirely, QueuelessBharat provides citizens with deterministic wait projections, bounded uncertainty intervals, and digital queuing before they travel.

---

## Core Principles

- **Predictability Over False Promises:** Acknowledge physical service constraints realistically; calculate honest, bounded waiting times using deterministic queuing mathematics rather than opaque heuristics or generative AI guesses.
- **Truth in Telemetry & Data Provenance:** Clearly demarcate simulated or demonstration data from actual telemetry. All demonstration metrics are explicitly labeled as **DEMO / SIMULATED DATA**.
- **Know Before You Go:** Empower citizens to discover verified public facilities across Indian urban markets, inspect active counter desks, and review wait confidence intervals before arriving on-site.
- **Civic Accessibility & Trust:** Built for everyday Indian citizens with high-contrast accessibility, multilingual support (English, Hindi, Marathi), zero-latency local caching, and verifiable Google / OIDC identity.
- **Strict Role Boundaries (RBAC):** Separate public citizen self-service from counter operator workspaces and system administration to safeguard civic data and counter workflows.

---

## Features

- **Deterministic Queue Estimator:**
  - Calculates mathematical wait projections based on Little's Law variations, empirical completed throughput, active counter capacity, and IQR outlier rejection.
  - Computes bounded uncertainty intervals (`lower_minutes` to `upper_minutes`) and transparent confidence ratings (`HIGH`, `MEDIUM`, `LOW`).
  - Transparent fallback handling for cold-start scenarios with insufficient history or closed counters (*"No active counters"* / *"Insufficient data"*).
- **Spatial Civic Explorer:**
  - 20 Indian urban markets (featuring Pune as the primary showcase city, alongside Mumbai, Bengaluru, Delhi, Hyderabad, and more).
  - Categorized service points (Hospitals, RTOs, Municipal Centers, Universities) with geographic coordinates and OpenStreetMap integration.
- **Digital Citizen Token Desk:**
  - Self-service queue token issuance with live lifecycle tracking (`WAITING` &rarr; `IN_SERVICE` &rarr; `COMPLETED` / `CANCELLED`).
  - HTTP short-polling telemetry updates without page reloads.
- **Authenticated Identity & Role-Based Access Control:**
  - Google Citizen Sign-In (OIDC / OAuth 2.0) for verified token issuance.
  - Role-guarded workspaces: `CITIZEN` (public tickets), `OPERATOR` (counter management), and `ADMIN` (facility catalog).
  - Protection against unauthorized resource access (BOLA/IDOR) and unprivileged role escalation.
- **Civic-First Visual Design System:**
  - Subdued Indian tricolour ambient theme and 24-spoke Ashoka Chakra security watermark inspired by official civic documents.
  - Seamless Light and Dark mode toggle respecting OS preferences and persisted in local storage.
  - Full multilingual support in English, Hindi (हिन्दी), and Marathi (मराठी).

---

## Setup / Quickstart

> [!NOTE]
> **Data Provenance Notice:** All seeded queue lengths, active counter states, and completed service sessions in the local demo environment are **DEMO / SIMULATED DATA** for algorithmic demonstration and testing. Live external facility telemetry and production cloud hosting are not active.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- *(Optional for bare-metal development)* Python 3.12+ with [uv](https://github.com/astral-sh/uv), Node.js 20+, and PostgreSQL 16

### 1. Run with Docker Compose (Recommended)

Start the complete multi-tier stack (PostgreSQL + FastAPI Monolith + Nginx React SPA):

```bash
# Start all services in the background
docker compose up -d --build

# Verify container health
docker compose ps

# View unified application logs
docker compose logs -f

# Stop all services
docker compose down
```

**Default Service Endpoints:**
- **Citizen Web Application:** [http://localhost:80](http://localhost:80)
- **FastAPI OpenAPI Documentation:** [http://localhost:8001/docs](http://localhost:8001/docs)
- **API Health Endpoint:** [http://localhost:8001/api/v1/health](http://localhost:8001/api/v1/health)

### 2. Demonstration Accounts

The default database seed provisions the following test identities:

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@queless.gov.in` | `AdminPass123!` | Global administration, facilities, and services |
| **Counter Operator** | `operator@queless.gov.in` | `OperatorPass123!` | Counter service execution (`startService`, `completeService`) |
| **Citizen Participant** | `citizen@queless.gov.in` | `CitizenPass123!` | Queue check-in, token tracking, and cancellation |

### 3. Local Development & Testing

#### Backend (FastAPI + Pytest)
```bash
cd backend
uv run alembic upgrade head
uv run python scripts/seed_data.py
uv run pytest
```

#### Frontend (React + Playwright)
```bash
cd frontend
npm install
npm run lint
npm run build
npx playwright test
```

---

## Contributions

Contributions to QueuelessBharat are welcome! To contribute:

1. Fork the repository and create a feature branch (`git checkout -b feature/your-feature-name`).
2. Adhere to code quality and testing standards:
   - Ensure backend changes pass `ruff check`, `ruff format`, and `pytest`.
   - Ensure frontend changes pass `oxlint`, `npm run build`, and `playwright test`.
3. Preserve mathematical transparency, deterministic calculation guarantees, and data provenance disclosures.
4. Submit a descriptive Pull Request targeting the `dev` branch.

---

## License

This repository does not currently include a formal open-source license file. All rights are reserved by the project authors and contributors. For permission requests, licensing inquiries, or civic partnership proposals, please contact the repository maintainers.
