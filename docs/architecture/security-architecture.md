# Security Architecture

> **Status:** Architecture Design / Pre-Implementation Baseline
> **Scope:** QueuelessBharat Infrastructure, Application, and Data Security

---

## 1. Security Design Overview

QueuelessBharat adopts a defense-in-depth security model spanning physical infrastructure, network perimeters, application logic, and operational access. The architecture enforces zero-trust principles across internal boundaries and ensures user privacy through data minimization.

---

## 2. Perimeter & Network Security

1. **Mandatory HTTPS / TLS 1.3:**
   All public traffic into the platform is encrypted in transit using TLS 1.2+ / 1.3 terminated at the Application Load Balancer. Insecure HTTP connections (port 80) automatically redirect to port 443 with HSTS headers.
2. **Private Network Placement:**
   Compute instances (Elastic Beanstalk) reside strictly inside private application subnets without public IPv4 addresses.
3. **Private Database Isolation:**
   PostgreSQL RDS instances reside in dedicated private database subnets with `PubliclyAccessible = false` and zero route table access to the Internet Gateway.
4. **Security Group Least Privilege:**
   Traffic flows exclusively along authorized paths: Internet ➔ ALB ➔ Application instances ➔ RDS PostgreSQL. No direct external access to database ports (5432) or instance application ports is possible.

---

## 3. Identity, Access Management & CI/CD Security

1. **IAM Least Privilege:**
   Every AWS identity and instance role is restricted to the specific actions and resources required for its workload. No wildcards (`*`) on critical resources.
2. **Zero Permanent Cloud Credentials in CI/CD (GitHub Actions OIDC):**
   Continuous Integration and deployment workflows do not store static AWS Access Keys (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`). Instead, GitHub Actions establishes an OpenID Connect (OIDC) trust relationship with AWS IAM, exchanging short-lived JSON Web Tokens (JWT) for temporary session credentials.
3. **Role Segregation:**
   Deployment pipelines use dedicated IAM roles with narrow permissions to upload artifacts and update infrastructure.

---

## 4. Secrets Management & Configuration Hygiene

1. **Absolute Ban on Committed Secrets:**
   No credentials, private keys, database passwords, API tokens, or encryption keys may ever be committed to the Git repository.
2. **Environment-Specific Secret Providers:**
   - **Local Development:** Developers use `.env` files matching `.env.example` templates; `.env` is permanently excluded via `.gitignore`.
   - **Cloud Environments (Staging & Production):** Secrets are provisioned through AWS Systems Manager Parameter Store (SecureString) or AWS Secrets Manager and injected dynamically into runtime environments.
3. **Automated Secret Scanning:**
   Pre-commit hooks and CI scans prevent accidental secret leakage before code enters the repository.

---

## 5. Environment Separation

The platform establishes strict boundary isolation across three environments:

| Environment | Purpose | Infrastructure & Data Isolation |
| :--- | :--- | :--- |
| **Development (`dev`)** | Local and sandboxed feature development. | Uses local containers/mock services or isolated dev database. No access to production resources or data. |
| **Staging (`staging`)** | Pre-production testing, automated integration tests, and release candidate verification. | Runs in isolated cloud VPC/subnets with synthetic benchmark data. Mirrors production configuration. |
| **Production (`prod`)** | Live citizen-facing platform. | Fully isolated cloud VPC with strict role-based access, multi-AZ redundancy, encrypted backups, and production logging. |

*Note: Staging and Production environments use entirely separate database instances, distinct encryption keys, and independent IAM roles.*

---

## 6. Secure Logging & Auditability

1. **Sanitized Structured Logging:**
   Application logs use structured JSON formatting. All logging pipelines enforce redaction filters to prevent accidental output of tokens, passwords, session cookies, or sensitive citizen query text.
2. **Audit Trails:**
   State-changing actions (such as counter status adjustments, manual override observations, and administrative updates) are persisted with actor metadata, IP address, and timestamps to provide non-repudiable audit trails.
3. **Log Immutability:**
   CloudWatch log groups are configured with retention policies and access controls preventing deletion or retroactive modification of logs.

---

## 7. Supply Chain & Vulnerability Management

1. **Dependency Vulnerability Scanning:**
   Automated vulnerability scanning (such as GitHub Dependabot and automated CI audit checks) monitors Python packages and frontend dependencies for known CVEs.
2. **Base Image Integrity:**
   When container packaging is introduced in subsequent milestones, all base images must derive from minimal, verified official distributions (e.g., Alpine or Debian Slim) and undergo automated vulnerability scanning.
