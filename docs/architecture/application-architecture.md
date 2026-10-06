# Application Architecture: Modular Monolith

> **Status:** Architecture Design / Pre-Implementation Baseline
> **Pattern:** Modular Monolith

---

## 1. Architectural Style & Rationale

QueueLess Bharat adopts a **Modular Monolith** architecture for its backend application. All core domain components reside within a single codebase and execute within a unified runtime process, organized strictly along distinct module and layer boundaries.

### Why Not Microservices?

Starting development as a collection of microservices introduces substantial overhead that directly conflicts with the project's velocity, stability, and operational goals:

1. **Simpler Deployment & Infrastructure:**
   A modular monolith compiles/packages into a single deployable unit (e.g., container or Elastic Beanstalk artifact). There is no need for distributed service discovery, service meshes, distributed tracing overhead, or multiple CI/CD delivery pipelines in early milestones.
2. **Lower Operational Complexity:**
   Operating, monitoring, and scaling a single application tier dramatically reduces moving parts and failure modes during early development.
3. **Cost Efficiency:**
   Running multiple microservices requires independent compute instances or complex container clusters, inflating cloud infrastructure costs without commensurate utility. A single application tier running in an auto-scaled target group optimizes resource allocation.
4. **Easier Debugging & Observability:**
   Request flows remain within a single process. Stack traces, local transaction boundaries, and logs are unified and immediate, avoiding distributed network latency, cross-network debugging, and distributed partial-failure headaches.
5. **Fast Hackathon & Iterative Development:**
   Domain models and service interfaces evolve rapidly during initial iterations. Refactoring in-process module boundaries is straightforward, whereas refactoring cross-network RPC/REST boundaries between distinct services is expensive and error-prone.
6. **Future Extraction Path:**
   Strict logical decoupling inside the monolith ensures that if a specific domain (such as the AI ingestion pipeline or background analytics) later demands independent scaling, it can be cleanly extracted into a dedicated service with minimal refactoring.

---

## 2. Logical Boundaries & Layering

The codebase is organized into discrete layers with unidirectional dependencies (top-to-bottom):

```
┌────────────────────────────────────────────────────────┐
│                      API Layer                         │
│  (Routers, HTTP Handlers, Request/Response Mappings)   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                 Schemas & Validation                   │
│         (Input DTOs, Output DTOs, Serializers)         │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│              Application Services Layer                │
│    (Business Orchestration, Workflow Coordination)     │
└────────────┬─────────────────────────────┬─────────────┘
             │                             │
┌────────────▼─────────────┐ ┌─────────────▼─────────────┐
│   Deterministic Engine   │ │     AI Adapter Module     │
│ (Wait Estimation, Math)  │ │ (Natural Language Parser) │
└────────────┬─────────────┘ └─────────────┬─────────────┘
             │                             │
┌────────────▼─────────────────────────────▼─────────────┐
│                     Domain Models                      │
│        (Core Business Entities, Rules, Enums)          │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│             Persistence & Data Access Layer            │
│       (Repositories, Database Sessions, Queries)       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                 Core & Configuration                   │
│        (Settings, Logging, Security Utilities)         │
└────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

1. **API Layer:**
   - Handles HTTP protocol concerns (headers, status codes, query parameters).
   - Authenticates and authorizes inbound requests.
   - Enforces rate limiting.
   - Delegates all business execution to Application Services without hosting domain logic.

2. **Schemas & Validation:**
   - Defines strict input/output Data Transfer Objects (DTOs).
   - Enforces syntax validation, range bounds, string trimming, and type checking before data reaches application services.

3. **Application Services Layer:**
   - Coordinates business transactions and use-case workflows (e.g., `RegisterQueueObservationService`, `ComputeLocationEstimatesService`).
   - Ensures atomicity across multiple repository operations.
   - Mediates interactions between persistence, domain models, and computational engines.

4. **Deterministic Queue Engine:**
   - Independent computational module with pure algorithms.
   - Implements queueing formulas (e.g., Little’s Law variations, historical moving averages, confidence intervals, freshness decay curves).
   - Encapsulates no HTTP or direct network dependencies.

5. **AI Adapter Module:**
   - Encapsulates external LLM/AI model communication behind a well-defined interface.
   - Parses unstructured natural language strings into candidate structured reports.
   - Operates in isolation: downstream failures or timeouts are trapped and surfaced as safe, non-blocking fallback states.

6. **Domain Models:**
   - Pure domain representations of business concepts (`QueueSession`, `Location`, `Counter`, `WaitObservation`, `Estimate`).
   - Enforces state transition invariants (e.g., a queue session cannot transition from `CLOSED` to `IN_PROGRESS` directly).

7. **Persistence & Data Access Layer:**
   - Encapsulates all SQL execution, transactions, and relational mapping.
   - Implements repository interfaces used by application services.
   - Isolates database schema details from higher-level domain rules.

8. **Core & Configuration:**
   - Application-wide infrastructure utilities: typed configuration loaded from environment variables, centralized structured logging, database connection factories, and cryptographic helpers.

---

## 3. Dependency Rules & Module Isolation

To preserve modular integrity within the single application:
- **No Circular Dependencies:** Higher layers depend on lower layers, never the reverse.
- **Persistence Decoupling:** Domain logic and the queue engine must not depend on database-specific ORM constructs directly; interactions happen via repositories or domain abstractions.
- **Isolate the AI Adapter:** No business-critical module or queue-estimation routine may call the AI adapter. Only inbound reporting ingest workflows invoke the adapter.
