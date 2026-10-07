# ADR-0006: Application Identity, Authentication, and RBAC Authorization Boundary

## Status
Accepted

## Context
In Milestones 1 through 3, QueueLess Bharat established its core queue domain, deterministic wait-time estimator, state machine, and browser-verified citizen queue workflow. However, all endpoints operated in an unauthenticated or pseudo-authenticated state where client-provided identifiers were trusted without verification.

To operate securely as a civic infrastructure platform handling real citizen queues, the system requires:
1. Verifiable user identity for citizens, desk operators, and administrators.
2. Protection against Broken Object Level Authorization (BOLA / IDOR), where malicious users could cancel or inspect another citizen's queue ticket by guessing UUIDs.
3. Strict Role-Based Access Control (RBAC) ensuring desk operators can only advance participants in service counters assigned to them, while citizens cannot manipulate queue state machines.
4. Total decoupling of security logic from the deterministic estimation engine (ADR-0003) and stateful transaction handling (ADR-0002).
5. Seamless compatibility with HTTP short polling (ADR-0005) without introducing session state on backend nodes.

## Decision
QueueLess Bharat implements a stateless, token-based identity and authorization boundary:

### 1. Identity Model
- A relational `users` table linked directly to PostgreSQL.
- Roles: `CITIZEN`, `OPERATOR`, `ADMIN` encapsulated in a typed `UserRole` enumeration.
- Passwords hashed using industry-standard salted bcrypt (`bcrypt==5.0.0`) with constant-time verification against timing attacks. Plaintext passwords never touch logs or persistent storage.
- Optional `assigned_service_id` foreign key on the `User` model, linking operators to their specific operational service.

### 2. Stateless Authentication Boundary
- Standard signed HMAC-SHA256 JSON Web Tokens (JWT) using `pyjwt==2.15.1`.
- Token claims include `sub` (user UUID), `email`, `role`, and `exp` expiration timestamp.
- Secret key and token lifetimes configured via environment settings (`AUTH_SECRET_KEY`, `AUTH_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`).
- Client transmits credentials as an HTTP `Authorization: Bearer <token>` header, preserving backend statelessness across horizontal instances.

### 3. Role-Based Access Control (RBAC) & Dependency Injection
- FastAPI dependency injection pipeline:
  - `get_current_user`: Decodes JWT, validates signature and expiration, retrieves active DB user.
  - `get_current_citizen`: Verifies identity and citizen/admin privilege.
  - `get_current_operator`: Restricts endpoint access strictly to `OPERATOR` and `ADMIN` roles.
  - `get_current_admin`: Restricts system administration (facility/service creation) strictly to `ADMIN`.

### 4. Resource-Level Authorization (BOLA / IDOR Protection)
- Tickets (`QueueSession`) bind the authenticated user's UUID (`user_uuid`) upon check-in.
- Ticket status inspection (`GET /queue/{id}/status`) and departure cancellation (`POST /queue/{id}/cancel`):
  - Citizens can ONLY access their own ticket sessions. Requests for other sessions receive `403 Forbidden`.
  - Desk operators can ONLY inspect sessions matching their `assigned_service_id`.
  - Admins retain overarching visibility across all facilities.
- Service operations (`POST /queue/{id}/start`, `POST /queue/{id}/complete`):
  - Only authorized operators assigned to the specific service or administrators can advance participant status.

### 5. Architectural Invariants Preserved
- The **deterministic wait estimation engine** remains 100% pure and independent of user authentication. Wait times, bounds, and confidence calculations are purely mathematical.
- Public monitors (`GET /api/v1/services/{id}/queue-status`) remain unauthenticated and freely queryable for aggregate civic display screens.

## Consequences

### Positive
- **Zero Identity Spoofing:** Prevents unauthenticated participation and malicious impersonation.
- **BOLA / IDOR Immune:** Hardened against horizontal privilege escalation and unauthorized ticket observation or cancellation.
- **Stateless Horizontal Scaling:** Backend API instances require no shared session cache; any node can validate incoming JWT requests.
- **Clean Audit Trail:** All state machine transitions are bound to authenticated citizen and operator identifiers.
- **Preserved Core Domain:** Zero alteration or corruption of deterministic queue algorithms.

### Negative / Tradeoffs
- **Token Invalidation:** Stateless JWT tokens cannot be immediately revoked before expiration without maintaining a token revocation list/blacklist. Mitigated by short token expiration lifetimes (default 60 minutes) and refresh workflows.
- **Token Size Overhead:** Each polling HTTP request carries an `Authorization` header containing the signed JWT string (~200 bytes). Negligible on modern networks.
