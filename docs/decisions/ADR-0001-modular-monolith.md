# ADR-0001: Use a Modular Monolith for the Initial Application

## Status
Accepted

## Context
When designing QueuelessBharat, we must balance long-term scalability and domain isolation with near-term delivery velocity, operational simplicity, infrastructure cost, and ease of debugging during hackathon and early-phase development.

A common industry temptation is to adopt microservices prematurely. However, distributed architectures introduce significant complexity: network latency, distributed transaction coordination, complex CI/CD pipelines, container orchestration overhead, and multi-service observability challenges.

QueuelessBharat requires distinct logical domains (API routing, queue state tracking, wait-time estimation engine, AI observation parsing, and relational persistence), but does not yet exhibit the organizational scale or divergent traffic profiles that justify distributed microservices.

## Decision
We will build the QueuelessBharat backend as a **Modular Monolith**.

All components will reside within a single repository and execute in a unified application runtime, but will be structured strictly along bounded module interfaces:
- API / Presentation Layer
- Application Services
- Deterministic Queue Engine
- AI Ingestion Adapter
- Domain Models & Schemas
- Persistence / Repositories

Direct cross-module database access is prohibited; modules communicate via defined in-process interfaces and service boundaries.

## Consequences

### Positive
- **Streamlined Deployment:** A single application artifact deployed to AWS Elastic Beanstalk, reducing operational overhead and cloud compute costs.
- **Simplified Transactionality:** ACID guarantees across queue sessions and event updates can be managed within local database transactions.
- **Fast Iteration & Refactoring:** Domain interfaces and schemas can be refactored with compile/type-check safety without breaking cross-network contracts.
- **Unified Observability:** Single-process stack traces, structured logs, and metrics provide immediate visibility into application behavior.
- **Clear Extraction Path:** Clean internal modular boundaries allow individual high-throughput domains (such as background analytics or the AI parser) to be cleanly extracted into independent microservices in the future if warranted.

### Negative / Tradeoffs
- **Single Deployment Boundary:** Deploying an update redeploys the entire monolith.
- **Shared Compute Resources:** Spikes in computational load in one module (e.g., intensive estimation recalculations) could impact API response latency if not properly isolated via asynchronous job queues.
- **Discipline Required:** Maintaining strict architectural layering within a monolith requires developer discipline and automated linting to prevent tight coupling.
