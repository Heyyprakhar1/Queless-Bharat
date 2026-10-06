# System Architecture Overview

> **Status:** Architecture Design / Pre-Implementation Baseline
> **System:** QueueLess Bharat

---

## 1. Executive Summary

QueueLess Bharat is a queue intelligence platform designed to bring transparency, predictability, and actionable decision support to public and civic waiting experiences (such as hospitals, Regional Transport Offices (RTOs), and municipal service centres).

The platform does not attempt to artificially hide queues or promise immediate zero-wait access. Instead, it measures, models, and communicates queue status, throughput, freshness, and confidence-bounded wait-time estimates so that citizens can plan their visits effectively.

---

## 2. High-Level System Architecture

The core runtime architecture follows a layered, predictable request flow designed around reliable transactional consistency:

```
[ User ]
    │
    ▼
[ Frontend Web Application ]
    │
    │ HTTPS (JSON / REST API)
    ▼
[ Backend API Layer ]
    │
    ▼
[ Application Services Layer ]
    │
    ▼
[ Deterministic Queue Engine ] ◄── (Authoritative Numerical Source of Truth)
    │
    ▼
[ PostgreSQL Database ] ◄──────── (System of Record)
```

### Component Roles & Responsibilities

1. **Frontend Web Application:**
   Presents service directories, current queue statuses, confidence intervals, freshness badges, and submission forms for citizen reports and observations. Consumes the backend REST API via standard HTTP short polling.

2. **Backend API Layer:**
   Serves as the entry point for all client communication. Responsible for authentication, input validation, request throttling/rate limiting, and routing requests to appropriate domain services.

3. **Application Services Layer:**
   Coordinates business operations, orchestrates workflows, enforces permissions and business rules, and bridges user interactions with the queue engine and persistence layer.

4. **Deterministic Queue Engine:**
   **The sole numerical source of truth for all wait-time estimates.** Computes lower bounds, upper bounds, expected wait times, and confidence metrics using validated mathematical and statistical formulas based on queue length, counter throughput, service rates, and historical distributions.

5. **PostgreSQL Database:**
   Relational system of record. Stores authoritative data including users, locations, services, physical counters, queue sessions, immutable queue events, audit trails, and derived estimates.

---

## 3. Assistive AI Pipeline & Boundaries

QueueLess Bharat incorporates Artificial Intelligence exclusively as an **assistive, non-authoritative input adapter**. AI simplifies citizen reporting by parsing unstructured inputs (natural-language text descriptions, speech-to-text transcripts, or casual status updates) into structured schema objects.

```
[ Natural-Language Citizen Input ] (e.g., "Counter 3 is moving fast, ~15 people waiting")
                 │
                 ▼
          [ AI Adapter ] (LLM / Structured Parser)
                 │
                 ▼
       [ Structured Extraction ] (tokens, candidate counts, counter IDs)
                 │
                 ▼
       [ Validation Boundary ] (schema validation, sanity bounds, rate limits)
                 │
                 ▼
    [ Queue Observation / Event ] (persisted as historical observation)
                 │
                 ▼
   [ Deterministic Queue Engine ] (calculates authoritative wait times & bounds)
```

### Strict Architectural Boundaries for AI

1. **Deterministic Engine is Authoritative:**
   Under no circumstances does an AI model directly generate, adjust, or override numerical wait-time estimates or confidence scores presented to users. All numerical estimations are calculated solely by the deterministic queue engine.
2. **Fail-Soft Isolation:**
   The AI adapter sits outside the critical path of core queue query and manual reporting workflows. If the AI service experiences latency, rate limiting, provider outages, or malformed responses, the system degrades gracefully: structured form submissions, queue queries, and manual counter updates continue functioning without interruption.
3. **Mandatory Schema Validation:**
   All output from the AI adapter must pass strict schema validation and range sanity checks before being admitted into the application as a candidate observation.

---

## 4. Architectural Principles

- **Predictability Over False Precision:** Estimates are expressed with explicit bounds (e.g., 35–50 minutes) and confidence ratings rather than misleading point precision (e.g., "exactly 41 minutes").
- **Auditability & Provenance:** Derived estimates are clearly separated from raw historical events and observations. The system retains full lineage of which algorithm version and input data produced each estimate.
- **Transactional Integrity:** Queue operations and status transitions rely on PostgreSQL's ACID guarantees to avoid race conditions or duplicate session states.
- **Fail-Safe Simplicity:** Core platform workflows prioritize proven architectural patterns (modular monolith, standard HTTP short polling, relational persistence) over premature distributed complexity.
