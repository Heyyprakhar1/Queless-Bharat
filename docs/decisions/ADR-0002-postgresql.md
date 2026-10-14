# ADR-0002: Use PostgreSQL as the Primary Database

## Status
Accepted

## Context
Queue management systems fundamentally manage physical and logical state transitions: counters open or close, tickets are dispensed, citizens advance in line, and observations are logged.

These workflows have strict correctness requirements:
- Two concurrent updates to a queue session must not corrupt state or result in phantom tickets.
- Derived estimates must maintain referential integrity with the underlying locations, services, and observations that generated them.
- Auditing and reporting require dependable aggregations, time-series window functions, and consistent historical views.

While NoSQL databases offer horizontal scale, they sacrifice relational constraints, transactional consistency, and rich querying capabilities, which are essential for managing civic queue lifecycles.

## Decision
We will use **PostgreSQL** as the primary system-of-record relational database for QueuelessBharat, hosted in production on Amazon RDS PostgreSQL.

PostgreSQL will manage all core entities:
- Users and authentication/trust metadata
- Locations, services, and physical counters
- Queue sessions, durable immutable queue events, and service sessions
- Citizen wait observations
- Analytical and deterministic queue estimates

## Consequences

### Positive
- **ACID Transactional Guarantees:** Ensures multi-step state changes (such as closing an active session, calculating summary metrics, and storing final estimates) succeed or roll back atomically.
- **Relational Integrity & Foreign Keys:** Prevents orphan records and guarantees data consistency across services, counters, and sessions.
- **Rich Analytical & Windowing Support:** PostgreSQL natively supports advanced SQL features (time-series window functions, Common Table Expressions, JSONB operations) valuable for historical throughput calculations.
- **Operational Maturity:** Widely supported across cloud providers, robust managed tooling via Amazon RDS (automated multi-AZ failover, automated point-in-time restores, encryption at rest).

### Negative / Tradeoffs
- **Vertical Scaling Model:** Primary writes are scaled vertically (or via read replicas for high query volume), requiring thoughtful index and query optimization.
- **Migration Overhead:** Schema modifications require structured migration scripts and deployment coordination.
