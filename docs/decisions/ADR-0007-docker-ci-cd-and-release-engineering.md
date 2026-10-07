# ADR-0007: Container Packaging, Docker Compose & CI/CD Release Engineering

## Status
Accepted

## Context
Following the completion of Milestones 1 through 4, QueueLess Bharat operates as a verified civic queue platform with deterministic wait-time estimation, stateful transactions, and Role-Based Access Control (RBAC). However, running the application previously relied on manual commands across separate terminal tabs (`uvicorn`, `npm run dev`, local Docker Postgres).

To establish a production-grade DevOps baseline ready for future cloud infrastructure (e.g., AWS ECR, ECS/EKS), the system requires:
1. Production-oriented Docker images that build deterministically and run with minimal attack surfaces.
2. Complete elimination of development servers (e.g., Vite dev server) from production runtimes.
3. Unprivileged (non-root) execution across all container runtimes.
4. Reproducible multi-service local deployment via Docker Compose with genuine healthcheck dependencies (`service_healthy`).
5. Automated Continuous Integration (CI) on GitHub Actions validating linting, formatting, type safety, database migrations, unit/integration tests, real browser E2E workflows, Docker builds, and container vulnerability scanning.

## Decision

### 1. Multi-Stage Docker Architecture

#### Backend Container (`queless-backend`)
- **Base Builder:** `python:3.12-slim` with `uv` binary copied from `ghcr.io/astral-sh/uv:0.6.14`.
- **Dependency Resolution:** `uv sync --frozen --no-dev --no-install-project` for deterministic, fast virtualenv assembly.
- **Runtime Stage:** `python:3.12-slim`.
- **Security & Privilege:** Runs as unprivileged system user `appuser` (`UID 999/non-root`).
- **Entrypoint:** Dedicated `entrypoint.sh` applying Alembic migrations automatically when `RUN_MIGRATIONS=true` and propagating PID 1 signals to Uvicorn for graceful shutdown.
- **Image Footprint:** ~233 MB.
- **Healthcheck:** Standard library `urllib.request` probing `/health`.

#### Frontend Container (`queless-frontend`)
- **Base Builder:** `node:22-alpine` compiling TypeScript and bundling static assets via Vite (`npm run build`).
- **Runtime Stage:** `nginx:1.27-alpine` serving pre-rendered static artifacts. No Node.js runtime or devDependencies in the final image.
- **Reverse Proxy & Routing:** Custom `nginx.conf` routing `/api/` to the backend service, providing SPA fallback (`try_files $uri $uri/ /index.html;`), static caching (`Cache-Control: public, max-age=31536000`), and Gzip compression.
- **Security & Privilege:** Runs as non-root user `nginx` listening on port `8080`.
- **Image Footprint:** ~48.8 MB.
- **Healthcheck:** Probes dedicated `/healthz` endpoint.

### 2. Docker Compose Environment (`docker-compose.yml`)
- Orchestrates `postgres`, `backend`, and `frontend` on a dedicated bridge network (`queless-network`).
- Uses healthcheck conditions (`condition: service_healthy`) rather than superficial container start dependencies:
  - `backend` waits until PostgreSQL passes `pg_isready`.
  - `frontend` waits until `backend` responds healthy on `/health`.
- Persistent database state managed via named volume `queless-postgres-data`.
- Environment template provided in `.env.example` with safe development defaults and explicit secret placeholders.

### 3. GitHub Actions CI Pipeline (`.github/workflows/ci.yml`)
Four automated pipeline stages triggered on every push and pull request to `main`:
1. **Static Validation:**
   - Backend: Ruff lint (`ruff check`) and formatting check (`ruff format --check`).
   - Frontend: Oxlint check, TypeScript validation (`tsc -b`), and production build verification.
2. **Backend Automated Tests:**
   - Spins up PostgreSQL 16 service container.
   - Applies Alembic migrations to `head` and asserts migration currency (`alembic current`).
   - Executes 71 pytest test cases with code coverage reporting.
3. **Browser E2E Playwright Tests:**
   - Seeds test database.
   - Launches application runtime in CI.
   - Executes 16 real browser Playwright tests covering citizen joining, operator desk actions, and RBAC security boundaries.
   - Uploads test artifacts on failure.
4. **Docker Build, Compose Validation & Trivy Security Scan:**
   - Validates `docker compose config`.
   - Builds both backend and frontend images using Docker Buildx.
   - Tags images deterministically using Git commit SHA (`${{ github.sha }}`) and short SHA.
   - Verifies non-root runtime enforcement (`whoami` must equal `appuser` and `nginx`).
   - Executes Trivy vulnerability scanner (`aquasecurity/trivy-action`) to scan OS packages and library dependencies for critical CVEs.

## Consequences

### Positive
- **Deterministic & Reproducible:** Eliminates "works on my machine" issues across developers and automated environments.
- **Cloud-Ready:** Images and tagging strategy can be plugged directly into AWS ECR, ECS, or EKS pipelines in subsequent milestones.
- **Security by Default:** Non-root users, minimal Alpine/Slim base images, zero development dependencies in production runtimes, and automated Trivy CVE scans.
- **Automated Gating:** Flawed code, broken migrations, or security regressions are automatically blocked from merging or releasing.

### Negative / Tradeoffs
- **Build Duration:** Multi-stage container builds and Playwright browser installation add ~2–3 minutes to CI pipeline runs (mitigated by GitHub Actions dependency caching for `uv` and `npm`).
