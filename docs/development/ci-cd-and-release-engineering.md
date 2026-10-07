# CI/CD, Container & Release Engineering Guide

This document outlines the DevOps foundation, container architecture, local Docker Compose operations, and automated GitHub Actions CI pipeline for QueueLess Bharat.

---

## 1. Container Architecture

QueueLess Bharat packages both the frontend and backend into minimal, production-hardened, non-root multi-stage Docker images.

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP :80
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 queless-frontend (Nginx)                    │
│  - Port 8080 internal (non-root user: nginx)                │
│  - Pre-rendered React 19 static bundle (/dist)              │
│  - Gzip compression, immutable asset caching                │
│  - Reverse proxy /api/ -> backend:8000/api/                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP :8000
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 queless-backend (FastAPI)                   │
│  - Port 8000 internal (non-root user: appuser)              │
│  - Python 3.12-slim runtime with uv virtualenv              │
│  - Auto-runs Alembic migrations via entrypoint.sh           │
└──────────────────────────────┬──────────────────────────────┘
                               │ PostgreSQL :5432
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 queless-postgres (DB)                       │
│  - PostgreSQL 16 Alpine                                     │
│  - Named volume: queless-postgres-data                      │
└─────────────────────────────────────────────────────────────┘
```

### Image Specifications

| Service | Base Image | Multi-Stage | Non-Root User | Size | Healthcheck Probe |
|---|---|:---:|:---:|:---:|---|
| **Backend** | `python:3.12-slim` | Yes (`uv` builder + runtime) | `appuser` (UID 999) | ~233 MB | `python -c "urllib.request.urlopen('/health')"` |
| **Frontend** | `nginx:1.27-alpine` | Yes (`node:22` builder + runtime) | `nginx` (UID 101) | ~48.8 MB | `wget --spider http://localhost:8080/healthz` |

---

## 2. Local Docker Compose Workflow

### Prerequisites
- Docker Engine 24+ and Docker Compose v2.

### Quickstart
```bash
# 1. Create environment configuration
cp .env.example .env

# 2. Build and launch the stack
docker compose up -d --build

# 3. Check health and service statuses
docker compose ps

# 4. View logs
docker compose logs -f backend

# 5. Tear down the stack
docker compose down -v
```

### Exposed Endpoints

| Service | URL | Purpose |
|---|---|---|
| **Frontend Web App** | `http://localhost:80` | Public Queue Monitor & Citizen Token Desk |
| **Backend API** | `http://localhost:8000/api/v1` | Core REST API endpoints |
| **API Docs (Swagger)** | `http://localhost:8000/api/v1/docs` | Interactive OpenAPI documentation |
| **ALB Healthcheck** | `http://localhost:8000/health` | Root health probe |

---

## 3. GitHub Actions CI Pipeline

The CI workflow is defined in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). It executes automatically on all pushes and pull requests to `main`.

### Pipeline Stages

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

---

## 4. Deterministic Image Tagging Strategy

Images built in CI and ready for registry pushing adhere to a deterministic tagging scheme:

1. **Short Commit SHA:** `queless-backend:${GITHUB_SHA::7}` (e.g., `queless-backend:8eb517c`). Uniquely identifies exact source state.
2. **Full Commit SHA:** `queless-backend:${GITHUB_SHA}` for strict deployment traceability.
3. **Latest Tag:** `queless-backend:latest` for local convenience.
4. **Semantic Release (Git Tags):** When a git tag like `v1.0.0` is pushed, images are tagged with `v1.0.0` and `v1.0`.

---

## 5. Security & Vulnerability Scanning

Container images are scanned automatically using **Aqua Security Trivy** (`aquasecurity/trivy-action`):
- Targets `CRITICAL` and `HIGH` severity vulnerabilities in both base OS packages and application dependencies.
- Only unfixed vulnerabilities are excluded (`ignore-unfixed: true`).
- Scans are reported in CI logs to prevent introducing vulnerable packages.
