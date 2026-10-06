# ADR-0004: Use AI as an Assistive Layer

## Status
Accepted

## Context
Citizens standing in physical queues or waiting areas often describe conditions in natural language (e.g., "Counter 2 just opened", "about 20 people in the main hall", "line is moving slowly due to a server issue") rather than filling out complex multi-field digital forms. Natural-language and voice updates dramatically lower user friction for crowd-sourced reporting.

However, relying on AI models in the core application path introduces availability risks (external API rate limits or outages), non-deterministic responses, execution latency (hundreds of milliseconds to seconds per call), and potential data injection attacks.

## Decision
We will employ **AI strictly as an assistive, non-authoritative translation and extraction layer**, completely isolated from core numerical estimation and primary application flows.

### Architecture & Isolation Rules
1. **Assistive Translation Only:** The AI Adapter translates unstructured citizen text/voice inputs into candidate structured schemas (e.g., extracting candidate counter numbers, estimated crowd headcounts, status descriptions).
2. **Deterministic Validation Boundary:** Extracted structured data must pass strict programmatic schema validation and sanity bounds before becoming an accepted observation.
3. **Deterministic Authority:** AI models are strictly forbidden from calculating, predicting, or adjusting numerical wait times, bounds, or confidence scores.
4. **Fail-Soft Isolation:** The AI ingestion pipeline is strictly optional. If the AI adapter experiences an error, network timeout, or service unavailability:
   - Structured web form reporting continues unimpeded.
   - Core wait-time queries and status dashboards continue uninterrupted.
   - Unprocessed natural language reports can be queued for background evaluation or fall back to manual form prompts.

## Consequences

### Positive
- **High Ingestion Accessibility:** Users can submit quick conversational snippets or voice transcripts, improving signal density.
- **System Resilience:** Complete immunity of the core application from external AI provider downtime, pricing changes, or throttling.
- **Cost Predictability:** AI inference calls occur only when a citizen chooses to submit natural-language text, never on high-volume read queries.
- **Safety & Verification:** Programmatic schema validation acts as a firewall against prompt injections or corrupted outputs.

### Negative / Tradeoffs
- **Extraction Inaccuracy:** Ambiguous user wording may result in failed extractions or rejected observations.
- **Dual Pipeline Maintenance:** The system must support both direct structured form submissions and AI-assisted conversational ingestion.
