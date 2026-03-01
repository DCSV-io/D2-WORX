# DEPLOYMENT.md — D²-WORX Multi-Instance Readiness

This document captures the current multi-instance posture of the D²-WORX platform: what scales horizontally today, what was fixed, and what needs attention for production deployments.

---

## Architecture Summary

D²-WORX is a microservices platform with the following topology:

| Component      | Technology        | Communication                     |
| -------------- | ----------------- | --------------------------------- |
| Geo Service    | .NET 10 / gRPC    | gRPC (sync), RabbitMQ (async)     |
| Auth Service   | Node.js / Hono    | HTTP (BetterAuth), gRPC (health + jobs) |
| REST Gateway   | .NET 10 / ASP.NET | HTTP → gRPC (reverse proxy)       |
| Web Client     | SvelteKit 5       | HTTP (SSR + client-side)          |
| PostgreSQL     | 18                | Per-service databases             |
| Redis          | 8.2               | Shared distributed cache          |
| RabbitMQ       | 4.1               | Async messaging                   |
| Aspire AppHost | .NET Aspire       | Orchestration + discovery         |

**Service discovery:** Aspire injects connection strings and service URLs via environment variables at startup. Services do not hard-code peer addresses.

---

## Current Topology

- **Development:** Single-instance per service via Aspire AppHost (no `.WithReplicas()` configured)
- **External services:** PostgreSQL, Redis, RabbitMQ run as shared containers — already support multiple consumers

---

## What Already Scales Horizontally

These components require **no code changes** to run multiple instances:

### Session Storage (3-Tier)

| Tier         | Storage   | Multi-Instance Behavior                          |
| ------------ | --------- | ------------------------------------------------ |
| Cookie cache | In cookie | Travels with the request — any instance can read |
| Redis        | Shared    | Any instance queries the same Redis              |
| PostgreSQL   | Shared    | Dual-write ensures durability across instances   |

No sticky sessions required. Session revocation propagates instantly via Redis.

### JWT Validation

- JWTs are self-contained — any instance validates with the cached JWKS public key
- JWKS endpoint (`/api/auth/jwks`) is backed by the database — all auth instances serve the same keys
- Key rotation (30-day cycle, 30-day grace) is database-driven, not instance-specific

### Rate Limiting (.NET Gateway)

- Redis-backed via `@d2/ratelimit` / `RateLimit.Default` — shared counters across all gateway instances
- Sliding window approximation uses Redis `INCR` + `TTL` — atomic, no cross-instance coordination needed

### Idempotency (.NET Gateway)

- Redis-backed `SET NX` with 24-hour TTL — dedup state shared across all gateway instances
- An idempotent request hitting any instance produces the same cached response

### Request Enrichment

- Stateless middleware — resolves IP, computes fingerprint, calls Geo WhoIs cache
- No instance affinity — identical output regardless of which instance processes the request

### External Services

- PostgreSQL, Redis, RabbitMQ are shared infrastructure — all instances connect to the same backends
- Connection pooling (pg.Pool, ioredis) is per-instance but targets the same servers

---

## Blockers Fixed

### 1. Auth Service In-Memory Rate Limiter

**Problem:** `rate-limit.ts` used a per-process `Map` for rate limit counters. With multiple auth instances, each has independent counters — an attacker rotating across instances gets N× the allowed rate.

**Fix:** Replaced with the production `@d2/request-enrichment` + `@d2/ratelimit` packages (Redis-backed multi-dimensional sliding window). Counters are shared via Redis — all instances increment the same keys.

---

## Known Limitations (Deferred)

These are deployment configuration concerns, not code bugs. They don't block horizontal scaling — they just need attention for non-Aspire deployments.

### OpenTelemetry Endpoints

`ServiceExtensions.cs` references `localhost` for OTEL collector endpoints. Aspire injects the correct values at runtime via `OTEL_EXPORTER_OTLP_ENDPOINT`. Only affects manual (non-Aspire) deployments — set the environment variable to point at the collector.

### gRPC Client Load Balancing

Within Aspire, service discovery resolves gRPC endpoints automatically. For production (multi-machine), options include:

- DNS round-robin (simplest — gRPC re-resolves on channel creation)
- Client-side balancing (`Grpc.Net.Client` supports `round_robin` policy)
- Reverse proxy (Envoy, nginx with gRPC support)

### No `.WithReplicas()` in AppHost

Aspire's `.WithReplicas(n)` is not yet configured for any service. This is cosmetic for development — it just controls how many instances Aspire spins up in the dashboard. Adding it is a one-line change per service when ready to test multi-instance locally.

---

## TLS / HTTPS Posture

**Current:** HTTP internally between services. Cloudflare Tunnel handles edge TLS (browser ↔ CF ↔ origin).

**Architecture:** All service URLs are environment-driven (`ASPIRE_*`, custom config). Switching internal traffic to HTTPS is a deployment config change:

1. Mount TLS certificates in service containers
2. Update Aspire/config to use `https://` URLs
3. Configure Kestrel HTTPS endpoints

No code changes required — URL schemes and ports are already configuration, not constants.

---

## Multi-Machine Setup

Cloudflare Tunnels remain viable for multi-machine deployments:

1. Run `cloudflared` on each machine, pointing at local services
2. CF load balances across tunnels via DNS (or CF Load Balancer)
3. All machines share the same PostgreSQL, Redis, and RabbitMQ (via connection strings)

**No sticky sessions required** — cookie cache, Redis sessions, and self-contained JWTs ensure any instance can handle any request.

---

## Scaling Checklist for New Services

When adding a new service, verify:

- [ ] **Cache invalidation broadcasts** — Use fanout exchanges with exclusive auto-delete queues per instance (not competing consumers) for cache refresh signals
- [ ] **Rate limiting** — Use `@d2/ratelimit` (Redis-backed) or `.NET RateLimit.Default`, never per-process Maps
- [ ] **Session/auth** — Validate JWTs via JWKS (no instance affinity), sessions via Redis
- [ ] **Idempotency** — Use Redis-backed `@d2/idempotency`, not in-memory dedup
- [ ] **Local caches** — Memory caches are per-instance (fine for read-heavy, TTL-bounded data). Ensure correctness doesn't depend on cache consistency across instances
- [ ] **Background jobs** — Use Dkron for scheduled jobs (HTTP callback to service endpoints). Use distributed locks (Redis `SET NX`) if only one instance should run a job
- [ ] **Connection strings** — Externalized via config/environment, not hardcoded
