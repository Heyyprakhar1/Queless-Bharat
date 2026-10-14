# ADR-0005: Start with Polling for Real-Time Queue Updates

## Status
Accepted

## Context
Civic queues evolve over minutes, not milliseconds. Service times per citizen at an RTO or hospital OPD typically range from 3 to 15 minutes. While users viewing a queue status dashboard need up-to-date visibility, updates do not require sub-second push latency.

Engineers frequently introduce WebSockets or Server-Sent Events (SSE) by default for any real-time UI. However, persistent two-way socket connections introduce significant operational complexity:
- Stateful connection management on backend servers.
- Complex connection rebalancing across auto-scaled Elastic Beanstalk instances.
- Sticky sessions or external pub/sub brokers (e.g., Redis) required for cross-node message routing.
- Load balancer connection timeouts and socket reconnection storms when mobile network connections drop.
- Incompatibility with standard HTTP caching and simple edge reverse proxies.

## Decision
QueuelessBharat will adopt **HTTP Short Polling** as its initial real-time update strategy.

The frontend client will query the queue status API at appropriate, configurable intervals (e.g., every 30 to 60 seconds when a user is actively viewing a queue screen, with exponential backoff when the browser tab is idle or backgrounded). Responses will leverage standard HTTP cache headers (`Cache-Control`, `ETag`, `Last-Modified`) to allow 304 Not Modified responses when state has not changed.

Any future migration to Server-Sent Events (SSE) or WebSockets will be evaluated based on:
1. Measured user experience needs where polling latency proves inadequate.
2. Production traffic and request scalability profiles.
3. Comparative infrastructure costs (HTTP request volume vs. persistent connection memory overhead).
4. Load balancer and connection broker operational complexity on AWS.

## Consequences

### Positive
- **Stateless Simplicity:** Backend application instances remain purely stateless HTTP handlers. Instances can scale up, scale down, or be replaced seamlessly behind the Application Load Balancer with zero connection disruption.
- **Resilient on Flaky Mobile Networks:** Public service visitors frequently navigate on intermittent 3G/4G cellular connections. Standard HTTP requests gracefully handle retries without complex socket reconnection states.
- **Cache Compatibility:** Responses can be cached by intermediate proxies, CDNs, or browser caches when state has not updated.
- **Zero Additional Infrastructure:** Eliminates the immediate need for Redis clusters or WebSocket gateway infrastructure on AWS.

### Negative / Tradeoffs
- **Polling Latency:** Changes in queue state will only be visible to clients after their next poll cycle (typically within 30–60 seconds).
- **Redundant Requests:** If queue status does not change between intervals, polling generates redundant HTTP requests (mitigated by lightweight payloads and `ETag`/`304 Not Modified` headers).
