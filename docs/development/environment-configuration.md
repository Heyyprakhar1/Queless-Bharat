# Environment Configuration Architecture

> **Status:** Engineering Standard / Pre-Implementation Baseline
> **Standard:** Twelve-Factor App Configuration Principles

---

## 1. Configuration Philosophy

QueueLess Bharat follows the [Twelve-Factor App](https://12factor.net/config) methodology for configuration management. Configuration that varies between deployment environments (such as database credentials, hostnames, log levels, and external API keys) must be strictly decoupled from application source code.

### Core Tenets
1. **Zero Hardcoded Configuration:** Application source code must not contain environment-specific hostnames, port numbers, or operational flags hardcoded in logic.
2. **Strict Ban on Committed Secrets:** API keys, database passwords, private keys, and session secrets must never be committed to Git.
3. **Fail-Fast Configuration Validation:** The application runtime must validate required configuration parameters at startup and terminate immediately if essential settings are missing or malformed.
4. **Typed Settings Model:** Configuration loaded from environment variables is parsed into strongly typed configuration objects with default fallback values where safe.

---

## 2. Environments Overview

| Environment | Purpose | Configuration & Secrets Source |
| :--- | :--- | :--- |
| **Development (`dev`)** | Local development on developer workstations. | Local environment variables or local `.env` file (uncommitted). |
| **Staging (`staging`)** | Pre-production testing, QA, and CI/CD validation. | AWS Systems Manager Parameter Store & AWS Secrets Manager (injected via Elastic Beanstalk environment configuration). |
| **Production (`prod`)** | Citizen-facing live production environment. | AWS Systems Manager Parameter Store & AWS Secrets Manager (strictly scoped IAM role injection). |

---

## 3. Configuration Management Workflow

### Local Development
- A version-controlled template file, `.env.example`, documents all required configuration variables, acceptable formats, and safe local default values.
- Developers copy `.env.example` to `.env` for local execution.
- The `.env` file is explicitly ignored in [`.gitignore`](file:///home/prakhar/Queless-Bharat/.gitignore) and is never committed to Git.

### Staging and Production Cloud Deployments
- Cloud runtime environments receive configuration through environment properties managed by AWS Elastic Beanstalk.
- Sensitive values (database passwords, API authentication tokens) are stored in **AWS Systems Manager Parameter Store** (SecureString) or **AWS Secrets Manager**.
- At runtime or instance initialization, instances retrieve secrets using their assigned IAM role credentials, ensuring credentials are never exposed in build artifacts or source repositories.

---

## 4. Configuration Schema (Conceptual)

When configuration schemas are implemented, they will encompass the following parameter domains:

- **Application Metadata:** `APP_ENV` (`development`, `staging`, `production`), `APP_PORT`, `LOG_LEVEL` (`DEBUG`, `INFO`, `WARNING`, `ERROR`).
- **Database Connectivity:** `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_SSL_MODE`.
- **CORS & Network:** `ALLOWED_ORIGINS`, `API_PREFIX`.
- **Queue Engine Tuning:** `QUEUE_ESTIMATE_DEFAULT_WINDOW_MINUTES`, `QUEUE_ESTIMATE_FRESHNESS_TTL_SECONDS`.
- **Assistive AI Adapter:** `AI_ADAPTER_ENABLED` (`true`/`false`), `AI_PROVIDER_API_KEY`, `AI_TIMEOUT_MS`.

*Note: All production settings will be provisioned using automated Terraform scripts and AWS managed stores in subsequent milestones.*
