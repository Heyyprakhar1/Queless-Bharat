# QueueLess Bharat

> *"Making waiting more predictable, not pretending queues don't exist."*

QueueLess Bharat is a queue intelligence platform designed to bring transparency, predictability, and actionable decision support to civic waiting times across public service touchpoints throughout India, including:

- **Hospitals & Healthcare Facilities**
- **Regional Transport Offices (RTOs)**
- **Government & Civic Service Centres**

Instead of offering unrealistic promises of eliminating physical lines entirely, QueueLess Bharat focuses on making waiting predictable through data-driven queue telemetry, bounded wait estimates, freshness indicators, and community-informed signals.

---

## Project Status

> **Current State:** Milestone 5 Complete — Docker, CI/CD & Release Engineering
>
> - **Milestone 0:** Architecture & Engineering Foundation (Complete)
> - **Milestone 1:** Technical Application Foundation — FastAPI + PostgreSQL + Alembic + React + Docker (Complete)
> - **Milestone 2:** Queue Domain Model & Deterministic Wait-Time Estimator (Complete)
> - **Milestone 3:** Production Hardening, End-to-End Queue Lifecycle & Playwright Verification (Complete)
> - **Milestone 4:** Identity Model, Stateless JWT Authentication, RBAC (`CITIZEN`, `OPERATOR`, `ADMIN`), BOLA/IDOR Protection, and Browser E2E Security Suite (Complete)
> - **Milestone 5:** Production Docker Multi-Stage Images, Non-Root Containers, Docker Compose Stack, and Automated GitHub Actions CI/CD Pipeline with Trivy Security Scanning (Complete)

---

## Quickstart (Docker Compose)

Launch the complete QueueLess Bharat application stack (PostgreSQL + Backend API + Frontend Nginx) with a single command:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start the reproducible stack with health-gated readiness
docker compose up -d --build

# 3. Access applications
# Frontend Web App:  http://localhost:80
# Backend API:       http://localhost:8000/api/v1
# API Docs:          http://localhost:8000/api/v1/docs
```

## Vision & Architecture Principles

- **Deterministic Queue Engine as Source of Truth:** Numerical wait-time estimates and confidence boundaries are computed solely by deterministic mathematical logic, never by probabilistic AI models.
- **AI as an Assistive Layer:** Artificial Intelligence is utilized strictly as an optional input adapter to parse unstructured natural-language citizen reports into structured schemas, failing soft without impacting core operations.
- **Relational Integrity with PostgreSQL:** Core queue state, transactions, and immutable historical events are managed with ACID reliability on Amazon RDS PostgreSQL.
- **Modular Monolith Architecture:** Backend components are structured along strict module boundaries within a unified runtime to ensure high development velocity, operational simplicity, and low cloud cost.
- **Polling-First Real-Time Strategy:** Reliable, stateless HTTP short polling provides predictable updates across mobile networks without WebSocket connection overhead.
- **Defense-in-Depth Cloud Security:** Multi-AZ AWS architecture separating public load balancers from private application compute and isolated private database tiers.

---

## Documentation Map

Detailed engineering specifications and decisions are organized under the [`docs/`](docs/) directory:

- **Architecture:**
  - [System Overview](docs/architecture/system-overview.md) — High-level request flow and component roles.
  - [Application Architecture](docs/architecture/application-architecture.md) — Modular monolith layering and domain boundaries.
  - [Data Architecture](docs/architecture/data-architecture.md) — Conceptual data model, entity relationships, and provenance rules.
  - [AWS Cloud Architecture](docs/architecture/aws-architecture.md) — VPC layout, subnet tiers, security groups, and egress policy.
  - [Security Architecture](docs/architecture/security-architecture.md) — Defense-in-depth controls, environment separation, and identity management.
- **Architectural Decision Records (ADRs):**
  - [ADR-0001: Modular Monolith](docs/decisions/ADR-0001-modular-monolith.md)
  - [ADR-0002: PostgreSQL as Primary Database](docs/decisions/ADR-0002-postgresql.md)
  - [ADR-0003: Deterministic Queue Estimation](docs/decisions/ADR-0003-deterministic-queue-estimation.md)
  - [ADR-0004: AI as Assistive Layer](docs/decisions/ADR-0004-ai-as-assistive-layer.md)
  - [ADR-0005: Polling-First Real-Time Strategy](docs/decisions/ADR-0005-polling-first-realtime-strategy.md)
  - [ADR-0006: Identity, Authentication & RBAC Boundary](docs/decisions/ADR-0006-authentication-and-authorization.md)
  - [ADR-0007: Container Packaging & CI/CD Release Engineering](docs/decisions/ADR-0007-docker-ci-cd-and-release-engineering.md)
- **API Reference:**
  - [Queue API Specification](docs/api/queue-api.md) — Public and operational queue endpoints.
  - [Authentication API Reference](docs/api/auth-api.md) — JWT auth, user registration, and RBAC matrix.
- **Development & Standards:**
  - [CI/CD & Release Engineering Guide](docs/development/ci-cd-and-release-engineering.md) — Docker architecture, Compose, and GitHub Actions CI.
  - [Development Workflow](docs/development/development-workflow.md) — Branch naming, Git lifecycle, and Conventional Commits.
  - [Testing Strategy](docs/development/testing-strategy.md) — Test pyramid and queue correctness scenarios.
  - [Environment Configuration](docs/development/environment-configuration.md) — Twelve-factor configuration and secrets management.
  - [Security Principles](docs/security/security-principles.md) — Developer security rules and data minimization guidelines.

---

## Contributing & Development Workflow

Contributions follow standardized branch naming (`feature/*`, `fix/*`, `infra/*`, `docs/*`) and Conventional Commits. For detailed guidelines, please refer to [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Repository

- **GitHub Repository:** [https://github.com/Heyyprakhar1/Queless-Bharat](https://github.com/Heyyprakhar1/Queless-Bharat)
- **Primary Branch:** `main`

---

## License

To be determined during initial development phases.
