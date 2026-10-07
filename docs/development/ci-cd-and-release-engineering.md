# Container, CI & Release Engineering Guide

This document outlines the container architecture, local Docker Compose operations, automated GitHub Actions CI pipeline, and release engineering standards for QueueLess Bharat.

---

## 1. Scope & Architectural Boundaries

To maintain rigorous engineering terminology, QueueLess Bharat strictly distinguishes between **Continuous Integration (CI)**, **Release Engineering**, and **Continuous Delivery (CD)**:

| Discipline | In Scope (Milestone 5) | Description & Components |
|:---|:---:|:---|
| **Continuous Integration (CI)** | **Yes** | Automated static analysis (Ruff, Oxlint, TypeScript), backend test suite against PostgreSQL, Playwright browser E2E tests, and Docker Buildx build validation. |
| **Release Engineering** | **Yes** | Deterministic SHA-based image tagging, immutable artifact generation, non-root user verification, and container CVE vulnerability scanning (Trivy). |
| **Continuous Delivery (CD)** | **No** | Actual automated deployment to cloud infrastructure (e.g., AWS ECS/EKS). Reserved for upcoming cloud infrastructure milestones. |

### Operational Boundaries Matrix

- **Currently Implemented:**
  - Local multi-container Docker Compose deployment with explicit healthcheck gating.
  - Multi-stage Docker packaging for backend and frontend runtimes.
  - Non-root container security enforcement (`appuser` UID 999, `nginx` UID 101).
  - GitHub Actions CI workflow triggered on all pull requests and pushes to `main`.
  - Automated database migration validation against genuine PostgreSQL service containers.
  - Deterministic SHA-based image tagging and Aqua Security Trivy container scanning.
- **Not Yet Implemented (Future Milestones):**
  - AWS cloud infrastructure (VPC, ALBs, ECS/EKS, RDS PostgreSQL, ElastiCache).
  - Automated cloud deployment pipelines (CD to staging/production).
  - Production TLS termination, certificates, and DNS routing.
  - Production secrets management (AWS Secrets Manager / Systems Manager Parameter Store).
  - Centralized observability, log aggregation, and alerting (CloudWatch / Prometheus).
  - Multi-instance database migration orchestration (e.g., ECS one-off tasks or K8s Jobs).
  - Automated blue-green deployment and rollback mechanisms.

---

## 2. Container Architecture

QueueLess Bharat packages both frontend and backend into minimal, production-hardened, non-root multi-stage Docker images.

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP :80
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 queless-frontend (Nginx)                    │
│  - Port 8080 internal (non-root user: nginx, UID 101)       │
│  - Pre-rendered React 19 static bundle (/dist)              │
│  - Gzip compression, immutable asset caching                │
│  - Reverse proxy /api/ -> backend:8000/api/                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP :8000
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 queless-backend (FastAPI)                   │
│  - Port 8000 internal (non-root user: appuser, UID 999)     │
│  - Python 3.12-slim runtime with uv virtualenv              │
│  - Optional auto-migrations via entrypoint.sh               │
└──────────────────────────────┬──────────────────────────────┘
                               │ PostgreSQL :5432
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 queless-postgres (DB)                       │
│  - PostgreSQL 16 Alpine                                     │
│  - Named volume: queless-postgres-data                      │
└──────────────────────────────┘
```

### Image Specifications

| Service | Base Image | Multi-Stage | Non-Root User | Size | Healthcheck Probe |
|---|---|:---:|:---:|:---:|---|
| **Backend** | `python:3.12-slim` | Yes (`uv` builder + runtime) | `appuser` (UID 999) | ~233 MB | `python -c "urllib.request.urlopen('/health')"` |
| **Frontend** | `nginx:1.27-alpine` | Yes (`node:22` builder + runtime) | `nginx` (UID 101) | ~48.8 MB | `wget -q --spider http://localhost:8080/healthz` |

---

## 3. Local Docker Compose Workflow

### Prerequisites
- Docker Engine 24+ and Docker Compose v2.

### Quickstart
```bash
# 1. Create environment configuration from template
cp .env.example .env

# 2. Build and launch the stack with healthcheck gating
docker compose up -d --build

# 3. Check health and service statuses
docker compose ps

# 4. View logs
docker compose logs -f backend

# 5. Tear down the stack and clean volumes
docker compose down -v
```

### Exposed Endpoints

| Service | Host URL | Description |
|---|---|---|
| **Frontend Web App** | `http://localhost:80` | Public Queue Intelligence Monitor & Citizen Token Desk |
| **Backend API** | `http://localhost:8000/api/v1` | Core REST API endpoints |
| **API Docs (Swagger)** | `http://localhost:8000/api/v1/docs` | Interactive OpenAPI documentation |
| **ALB Healthcheck** | `http://localhost:8000/health` | Root health probe |

---

## 4. Database Migration Strategy

### Current Local Behavior
In local single-instance environments and Docker Compose, the backend container entrypoint script (`backend/entrypoint.sh`) executes:

```bash
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    alembic upgrade head
fi
```

In `docker-compose.yml`, `RUN_MIGRATIONS: "true"` is passed by default. This ensures local environments automatically achieve schema currency on startup without manual execution.

### Disabling Automatic Migrations
Automatic startup migrations can be safely disabled by setting:
```bash
RUN_MIGRATIONS=false
```
When set to `false`, the container bypasses Alembic execution and directly boots Uvicorn via `exec "$@"`.

### Multi-Instance Production Deployment Warning
> [!WARNING]
> In future multi-instance cloud deployments (e.g., AWS ECS Service with autoscaling or Kubernetes Deployments), running `alembic upgrade head` inside every application replica causes race conditions, database lock contention, and migration history corruption.
>
> Prior to multi-instance production release, database migrations **must be decoupled** from application pod/task startups and executed as an isolated single-runner release step (such as an AWS ECS one-off run-task, Kubernetes Job, or dedicated CI/CD release stage). All long-running application web containers in production must run with `RUN_MIGRATIONS=false`.

---

## 5. GitHub Actions CI Pipeline

The CI workflow is defined in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) and executes on all pushes and pull requests to `main`.

### Pipeline Topology

```
Code Push / Pull Request
           │
           ▼
┌────────────────────────────────────────┐
│        1. Static Validation            │
│  - Ruff lint & format check (Backend)  │
│  - Oxlint & TypeScript check (Frontend)│
│  - Production Vite bundle build        │
└──────────────────┬─────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ 2. Backend Tests │ │  4. Docker Build │
│ - Postgres 16 svc│ │ - Compose config │
│ - Alembic migrate│ │ - Buildx images  │
│ - Pytest (cov)   │ │ - Non-root check │
└────────┬─────────┘ │ - Trivy CVE scan │
         │           └──────────────────┘
         ▼
┌──────────────────┐
│  3. Browser E2E  │
│ - Playwright     │
│ - 16 test cases  │
│ - Artifact upload│
└──────────────────┘
```

### Pipeline Jobs

1. **`static-validation`:**
   - Validates Python code quality via `ruff check .` and formatting via `ruff format --check .`.
   - Validates frontend via `oxlint`, `tsc -b` (strict TypeScript validation), and `npm run build` (production Vite bundling).
2. **`backend-tests`:**
   - Spawns a genuine `postgres:16-alpine` service container with `pg_isready` healthcheck.
   - Applies migrations (`alembic upgrade head`) and verifies schema currency (`alembic current`).
   - Executes 71 pytest integration/unit tests with code coverage reporting.
3. **`browser-e2e-tests`:**
   - Spawns PostgreSQL service container, migrates schema, and seeds realistic test data.
   - Starts backend API (port 8001) and frontend preview (port 5173).
   - Installs Playwright Chromium and executes 16 real browser user journey tests.
   - Archives test traces, videos, and server logs on failure (`retention-days: 7`).
4. **`docker-build-and-scan`:**
   - Validates `docker compose config`.
   - Builds both backend and frontend images with Docker Buildx.
   - Verifies runtime user privileges (`whoami` must yield `appuser` and `nginx`).
   - Executes Aqua Security Trivy vulnerability scanner on both images.

---

## 6. Deterministic Image Tagging & Release Engineering

Artifacts built during release engineering adhere to strict tagging conventions:

1. **Immutable Commit SHA:** `queless-backend:${GITHUB_SHA}`
   - Guarantees exact cryptographic traceability back to the source commit.
   - Eliminates tag drift and ensures deterministic, reproducible rollbacks.
2. **Short Commit SHA:** `queless-backend:${GITHUB_SHA::7}` (e.g., `queless-backend:c2afc0a`)
   - Human-readable identifier for CLI operations and deployment manifests.
3. **Latest Tag (Local Only):** `queless-backend:latest`
   - Provided strictly for local development ergonomics.
   - **Anti-pattern in production:** Never deploy `:latest` to cloud environments as it masks artifact provenance and breaks container caching.

*Note: Remote container registry publication (e.g., pushing to AWS ECR) is deferred to future cloud infrastructure milestones.*

---

## 7. Container Security & Hardening

1. **Non-Root Runtime Enforcement:**
   - Backend runs as system user `appuser` (UID 999).
   - Frontend runs as system user `nginx` (UID 101) binding to unprivileged port `8080`.
2. **Minimal Attack Surfaces:**
   - Multi-stage builds eliminate compiler toolchains, `uv` cache, and devDependencies from final images.
   - Base Alpine packages upgraded (`apk --no-cache upgrade`) to eliminate known OS vulnerabilities.
3. **Secrets Hygiene:**
   - `.dockerignore` strictly excludes `.env*`, `.git`, `.github`, test files, and local caches.
   - No credentials or API keys are baked into container layers.
   - Sensitive values are injected exclusively via runtime environment variables.
4. **Health Check Architecture:**
   - Probes use standard language runtimes or built-in utilities (`urllib.request` in Python, `wget` in Alpine), avoiding unnecessary third-party package installations.
   - Health endpoints expose zero secrets, credentials, or internal topology details.
