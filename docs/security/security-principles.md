# Security Principles & Engineering Standards

> **Status:** Engineering Standard / Pre-Implementation Baseline
> **Audience:** All Contributors and Engineering Agents

---

## 1. Core Principles

QueueLess Bharat operates under a strict, non-negotiable set of security engineering principles designed to protect citizen privacy, maintain infrastructure integrity, and ensure platform availability:

### 1. Zero Secrets in Git
- Under no circumstances may credentials, database passwords, private keys, API tokens, or secrets be committed to version control.
- Configuration templates (`.env.example`) must contain only dummy or placeholder values.
- If a secret is ever accidentally committed, it must be considered immediately compromised, invalidated, rotated, and purged from Git history.

### 2. Defense-in-Depth
- Security controls must exist at multiple overlapping layers: network perimeter, load balancing, instance-level security groups, application-level schema validation, authentication/authorization, and database constraints.
- Breaching any single defensive perimeter must not grant access to the wider infrastructure.

### 3. Principle of Least Privilege
- Every IAM role, database user account, and service token must possess strictly the minimum set of permissions necessary to execute its designated task.
- Application compute instances must not possess database administrative privileges or broad AWS cloud permissions.

### 4. Data Minimization & Citizen Privacy
- Collect and store only the data strictly necessary for queue estimation (crowd counts, service categories, timestamps).
- Do not store Personally Identifiable Information (PII) such as Aadhaar numbers, national identity cards, residential addresses, or confidential medical diagnostic details.
- Public observation reports should be aggregated and decoupled from permanent citizen identities.

### 5. Secure Defaults & Fail Closed
- By default, all network traffic must be encrypted with TLS.
- Database connections must enforce SSL/TLS encryption.
- APIs must reject unvalidated or malformed inputs with explicit HTTP 400 Bad Request responses.
- Access to administrative routes must fail closed upon missing or expired authentication credentials.

### 6. Sanitized Structured Logging
- Application logs must use structured JSON format.
- Authorization headers, passwords, session tokens, and raw citizen messages must be scrubbed or redacted before logs are transmitted to CloudWatch.

### 7. AI Adapter Fail-Soft Boundary
- External AI services must be treated as untrusted third-party inputs.
- AI failures, delays, or invalid outputs must never cascade to core queue status endpoints or compromise database records.

---

## 2. Developer Security Checklist

Before proposing or merging any pull request, verify:
- [ ] No hardcoded passwords, tokens, or local network IPs are embedded in code or configuration.
- [ ] All database queries utilize parameterized queries or ORM constructs that eliminate SQL injection vulnerabilities.
- [ ] All new HTTP endpoints enforce input validation schemas.
- [ ] Logging statements do not output sensitive payload attributes.
- [ ] Newly added dependencies have been verified against known CVEs.
