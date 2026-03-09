# D²-WORX Internal Planning Document

> **Purpose**: Internal planning, architecture decisions, and status tracking for D²-WORX development.
> This document is for development reference and should not be considered user-facing documentation.

---

## Table of Contents

1. [Roadmap](#roadmap)
   - [Phase 2: Auth Service + SvelteKit Integration](#phase-2-auth-service--sveltekit-integration)
   - [Phase 3: Auth Features (Future)](#phase-3-auth-features-future)
2. [Issues](#issues)
   - [Open — Can Fix Now](#open--can-fix-now)
   - [Open Questions](#open-questions)
   - [Deferred Upgrades](#deferred-upgrades)
   - [Blocked — Can Only Fix Later](#blocked--can-only-fix-later)
3. [Work in Progress](#work-in-progress)
4. [Implementation Status](#implementation-status)
   - [Infrastructure](#infrastructure)
   - [Shared Packages (.NET)](#shared-packages-net)
   - [Shared Packages (Node.js)](#shared-packages-nodejs)
   - [Services](#services)
   - [Gateways](#gateways)
   - [Frontend](#frontend)
5. [Architecture Decisions](#architecture-decisions)
   - [ADR-001: Authentication Architecture](#adr-001-authentication-architecture)
   - [ADR-002: Rate Limiting Strategy](#adr-002-rate-limiting-strategy)
   - [ADR-003: Geo Data Caching Strategy](#adr-003-geo-data-caching-strategy)
   - [ADR-004: Fingerprinting Approach](#adr-004-fingerprinting-approach)
   - [ADR-005: Request Flow Pattern (Hybrid BFF + Direct Gateway)](#adr-005-request-flow-pattern-hybrid-bff--direct-gateway)
   - [ADR-006: Retry & Resilience Pattern](#adr-006-retry--resilience-pattern)
   - [ADR-007: Idempotency Middleware](#adr-007-idempotency-middleware)
   - [ADR-008: Sign-Up Flow & Cross-Service Ordering](#adr-008-sign-up-flow--cross-service-ordering)
   - [ADR-009: Drizzle ORM for Auth Database](#adr-009-drizzle-orm-for-auth-database-replacing-kysely)
   - [ADR-010: Reserved](#adr-010-reserved)
   - [ADR-011: Lightweight DI Container (`@d2/di`)](#adr-011-lightweight-di-container-d2di)
   - [ADR-012: Service-to-Service Trust (S2S)](#adr-012-service-to-service-trust-s2s)
   - [ADR-013: Scheduled Jobs (Dkron)](#adr-013-scheduled-jobs-dkron)
   - [ADR-014: Comms Delivery Engine](#adr-014-comms-delivery-engine)
   - [ADR-015: SvelteKit Strategy](#adr-015-sveltekit-strategy)
   - [ADR-016: Environment Variable Architecture](#adr-016-environment-variable-architecture)
   - [ADR-017: Auth BFF Client Pattern](#adr-017-auth-bff-client-pattern)
   - [ADR-018: Dependency Update Policy](#adr-018-dependency-update-policy)

---

## Roadmap

### Completed Milestones

- **Phase 1: TypeScript Shared Infrastructure** ✅ — 19 shared `@d2/*` packages mirroring .NET (result, handler, DI, caching, messaging, middleware, batch-pg, errors-pg)
- **Phase 2 Stage A: Cross-cutting foundations** ✅ — Retry utility, idempotency middleware, UUIDv7
- **Phase 2 Stage B: Auth Service DDD layers** ✅ — domain, app, infra, api (922 tests, 71 test files)
- **Comms Service Phase 1** ✅ — Delivery engine, email + SMS providers, `@d2/comms-client` (592 tests, 46 test files)
- **E2E Cross-Service Tests** ✅ — 12 tests (Auth → Geo → Comms delivery pipeline + Dkron job chain)
- **Cross-platform Parity** ✅ — `@d2/batch-pg`, `@d2/errors-pg`, .NET `Errors.Pg`, documented in `backends/PARITY.md`
- **.NET Gateway** ✅ — JWT auth, request enrichment, rate limiting, CORS, service key middleware
- **Geo Service** ✅ — Complete (.NET), 759 tests
- **Production-readiness Sweep** ✅ — 40 items triaged, all high/medium fixed, polish items done
- **Scheduled Jobs (Dkron)** ✅ — 8 daily maintenance jobs (Auth 4, Geo 2, Comms 2), `@d2/dkron-mgr` reconciler (64 tests), full-chain E2E tested (12 E2E tests)
- **Shared tests** — 857 passing (67 test files)

### Phase 2: Auth Service + SvelteKit Integration

**Stage B.5 — Scheduled Jobs (Dkron) ✅** — See [ADR-013](#adr-013-scheduled-jobs-dkron).

**Dependency Update — Q1 2026** — Pending. Quarterly bump before SvelteKit feature pages. See [ADR-018](#adr-018-dependency-update-policy).

**SvelteKit App Foundations ✅** — Route groups, layouts, sidebar, shadcn-svelte, design system, server middleware (enrichment + rate limiting + idempotency), auth BFF proxy, API gateway client. See [WIP](#work-in-progress) for step-by-step progress.

**Stage C — Auth Client Libraries (In Progress)**

- **@d2/auth-bff-client** ✅ — BFF client for SvelteKit (ADR-017). SessionResolver, JwtManager, AuthProxy, route guards. 32 unit + 10 E2E tests.
- **@d2/auth-client** — Backend gRPC client for other Node.js services (mirrors `@d2/geo-client` pattern). Planned.
- **.NET Auth.Client** — JWT validation via JWKS + `AddJwtBearer()`, gRPC client. Planned.

**Stage D — Auth Integration + Comms Con't**

- **Forms architecture** — Superforms + Formsnap, Zod schemas, D2Result error mapping
- **Auth pages** — Sign-in, sign-up, forgot/reset password, email verification
- **Onboarding** — Post-verification: accept pending invitation(s) or create `customer` org
- **Session management** — Org switching, active session list, sign-out
- **Client telemetry** — Grafana Faro (errors → Loki, traces → Tempo, Web Vitals → Mimir)
- **App shell finalization** — Org-type nav, org switcher, emulation banner, breadcrumbs
- **SignalR integration** — Browser → .NET gateway direct (`@microsoft/signalr`)
- **Comms Phase 2** — In-app notifications, push via SignalR

Auth service architecture documented in [`AUTH.md`](backends/node/services/auth/AUTH.md).

### Phase 3: Auth Features (Future)

1. **Session management UI** (list sessions, revoke individual, revoke all others)
2. **Org emulation** (support/admin can view any org's data in read-only mode)
3. **User impersonation** (escalated support — act as a specific user, audit-logged, time-limited)
4. **Admin control panel** (cross-org visibility, user/org management, system diagnostics)
5. **Admin alerting** (rate limit threshold alerts via Comms service)
6. **Comms expansion** — In-app notifications, push via SignalR, conversational messaging (Comms Phases 2-4)

---

## Issues

### Open — Can Fix Now

| #   | Item                                                | Owner  | Effort | Notes                                                                                                              |
| --- | --------------------------------------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| 32  | Thundering herd protection on popular key expiry    | Shared | Medium | Add singleflight/lock pattern for cache-memory on popular key expiry                                               |
| 39  | Circuit breaker for non-critical cross-service gRPC | All    | Medium | Add circuit breaker pattern (e.g., `opossum`) around geo-client gRPC calls — fast-fail under sustained Geo failure |
| 40  | OTel alerting for service outages                   | All    | Medium | Add OTel-based alerting rules for service unavailability (gRPC failures, RabbitMQ down, Redis down)                |

### Open Questions

- **Emulation/impersonation implementation details**: Authorization model decided (org emulation = read-only no consent, user impersonation = user-level consent, admin bypass). Remaining: should impersonation require 2FA? Should there be a max impersonation duration? How does `emulation_consent` integrate with BetterAuth's `impersonation` plugin hooks?

### Deferred Upgrades

From Q1 2026 audit:

| Item                             | Priority | Notes                                                                                                                                                         |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MinIO replacement                | Medium   | Project archived Feb 2026. Pinned images still work. Evaluate Garage (AGPLv3), RustFS (Apache 2.0), or SeaweedFS (Apache 2.0) as a separate initiative.       |
| EF Core → 10.0.3                 | Blocked  | `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.0 pins EF Core Relational to 10.0.0. Wait for Npgsql EF provider 10.0.x release.                                |
| Serilog.Enrichers.Span removal   | Low      | Deprecated upstream — Serilog now natively supports span data. Low-priority cleanup.                                                                          |
| dotenv.net 4.0                   | Low      | Major version with potential API changes. Only used in .NET Utilities.                                                                                        |
| Mimir 3.0                        | Low      | Major architectural change (Kafka buffer, new MQE, Consul/etcd deprecated). Requires deploying second cluster. Dedicated sprint.                              |
| RedisInsight 3.x                 | Low      | Dev tool only. Major version with new UI + storage changes. 2.70.1 still works.                                                                               |

### Blocked — Can Only Fix Later

| #   | Item                                        | Blocker                                       | Priority | Notes                                                                                                                                                          |
| --- | ------------------------------------------- | --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Graceful shutdown: drain RabbitMQ consumer  | MessageBus needs new `drain()` API            | P2       | Consumer not drained before SIGTERM — in-flight messages lost                                                                                                  |
| 2   | Graceful shutdown test                      | Needs #1 (drain API) first                    | P2       | Can't test shutdown behavior until drain is implemented                                                                                                        |
| 3   | E2E delivery pipeline retry path test       | Comms retry scheduler not built (Phase 2/3)   | P2       | Retry processor that picks up failed attempts doesn't exist yet                                                                                                |
| 4   | Hook integration tests with real BetterAuth | BetterAuth test lifecycle infra not built     | P2       | Starting/stopping BetterAuth with real DB in test harness needs new infra                                                                                      |
| 5   | E2E Org contact CRUD flow test              | Stage C (auth org routes not built)           | P2       | Requires auth org contact API routes + multi-service orchestration                                                                                             |
| 6   | Validate PII redaction in OTel output       | Running observability stack (Grafana/Loki)    | High     | Manually verify no PII in production log/trace output                                                                                                          |
| 7   | OTel alerting rules                         | Running AlertManager/Grafana                  | Medium   | Error rate spikes, latency P99, rate limit blocks, delivery failures                                                                                           |
| 8   | `dotnet outdated` in CI pipeline            | CI pipeline not set up yet                    | P3       | Automated dependency staleness checks                                                                                                                          |
| 9   | Service auto-restart / readiness probes     | Deployment infrastructure (K8s/Aspire health) | Medium   | Auto-restart policies, graceful startup when deps aren't ready, readiness probes                                                                               |
| 10  | Verification email delivery confirmation    | SignalR / push infra (Comms Phase 2/3)        | P2       | FE should show pending state, listen on SignalR for delivery result. Generalizes to all async delivery feedback. `sendOnSignIn: true` auto-retries on recovery |

---

## Work in Progress

Current focus: **Phase 2 Stage C — SvelteKit Web Client** (`feat/client-web` branch)

Full implementation plan: [`clients/web/IMPLEMENTATION_PLAN.md`](clients/web/IMPLEMENTATION_PLAN.md)

### SvelteKit Implementation Progress

| Step | Name                                | Status   | Notes                                                                    |
| ---- | ----------------------------------- | -------- | ------------------------------------------------------------------------ |
| 0    | Document Implementation Plan        | ✅ Done  |                                                                          |
| 1    | Error Handling Foundation + Types   | ✅ Done  | App.Error, hooks, error page, client-error endpoint                      |
| 2    | shadcn-svelte + Theme + Tokens      | ✅ Done  | Zinc OKLCH theme, Gabarito font, mode-watcher, Sonner toasts             |
| 2.5  | Server-Side Middleware              | ✅ Done  | Request enrichment, rate limiting, idempotency. SvelteKit→Geo gRPC       |
| 3    | Design System Sprint (Kitchen Sink) | ✅ Done  | 27 components, 3 OKLCH presets, live theme editor at `/design`           |
| 3.5  | Design Review & Polish              | ✅ Done  | Playwright visual QA, 11 fixes across 6 theme/mode combos               |
| 4    | Route Groups + Layout System        | ✅ Done  | (auth), (onboarding), (app) groups, sidebar, auth guard stubs            |
| 5    | @d2/auth-bff-client + Auth Proxy    | ✅ Done  | 32 unit + 10 E2E tests. Session resolver, JWT manager, route guards      |
| 6    | API Client Layer (Gateway)          | ✅ Done  | 66 tests. camelCase normalizer, dynamic public URL, service key bypass   |
| 6.5  | Chart Showcase (LayerChart 2.0)     | ✅ Done  | 5 chart types: area, bar, line, donut, sparkline                         |
| 7    | Forms Architecture (Superforms)     | ✅ Done  | 73 tests. Superforms + Formsnap + Zod 4, field presets, D2Result mapping |
| 8    | Auth Pages (Sign-In, Sign-Up, etc.) | ✅ Done  | Sign-in, sign-up, forgot/reset password, verify-email. i18n (5 locales) |
| 9    | Client Telemetry (Grafana Faro)     | Pending  | Errors → Loki, traces → Tempo, Web Vitals → Mimir                       |
| 10   | Onboarding Flow                     | Pending  | Post-auth org selection/creation + Radar address autocomplete backend    |
| 11   | App Shell (Sidebar, Header, Org)    | Pending  | Org-type nav, org switcher, emulation banner, breadcrumbs                |
| 12   | SignalR Abstraction Layer           | Pending  | Browser → .NET SignalR gateway direct (`@microsoft/signalr`)             |

### Other Active Work

| Task                          | Status  | Related ADRs | Notes                                             |
| ----------------------------- | ------- | ------------ | ------------------------------------------------- |
| Dependency audit & update     | Pending | ADR-018      | Q1 2026 quarterly bump — pre-SvelteKit            |
| @d2/auth-client (backend gRPC)| Planned | —            | Mirrors @d2/geo-client pattern, Stage C           |
| .NET Auth.Client              | Planned | ADR-001      | JWT validation via JWKS + gRPC client             |

### Recently Completed

- Auth pages: sign-in, sign-up, forgot-password, reset-password, verify-email (Step 8)
- Forms architecture: Superforms + Formsnap + Zod 4, 73 tests (Step 7)
- Auth-aware public nav, language selector, email branding
- @d2/auth-bff-client package (ADR-017) — 32 unit + 10 E2E tests
- API client layer with camelCase normalizer (ADR-005)
- Design system page + chart showcase (LayerChart 2.0)

---

## Implementation Status

### Infrastructure

| Component     | Status  | Notes                                                    |
| ------------- | ------- | -------------------------------------------------------- |
| PostgreSQL 18 | ✅ Done | Aspire-managed                                           |
| Redis 8.2     | ✅ Done | Aspire-managed                                           |
| RabbitMQ 4.1  | ✅ Done | Aspire-managed                                           |
| MinIO         | ✅ Done | Aspire-managed                                           |
| Dkron 4.0.9   | ✅ Done | Aspire-managed, persistent container, dashboard on :8888 |
| LGTM Stack    | ✅ Done | Full observability                                       |

### Shared Packages (.NET)

| Package                       | Status  | Location                                                                                        |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| D2.Result                     | ✅ Done | `backends/dotnet/shared/Result/`                                                                |
| D2.Result.Extensions          | ✅ Done | `backends/dotnet/shared/Result.Extensions/`                                                     |
| D2.Handler                    | ✅ Done | `backends/dotnet/shared/Handler/`                                                               |
| D2.Interfaces                 | ✅ Done | `backends/dotnet/shared/Interfaces/` (includes GetTtl, Increment)                               |
| D2.Utilities                  | ✅ Done | `backends/dotnet/shared/Utilities/`                                                             |
| D2.ServiceDefaults            | ✅ Done | `backends/dotnet/shared/ServiceDefaults/`                                                       |
| DistributedCache.Redis        | ✅ Done | `backends/dotnet/shared/Implementations/Caching/` (Get, Set, Remove, Exists, GetTtl, Increment) |
| InMemoryCache.Default         | ✅ Done | `backends/dotnet/shared/Implementations/Caching/`                                               |
| Transactions.Pg               | ✅ Done | `backends/dotnet/shared/Implementations/Repository/`                                            |
| Batch.Pg                      | ✅ Done | `backends/dotnet/shared/Implementations/Repository/`                                            |
| **RequestEnrichment.Default** | ✅ Done | `backends/dotnet/shared/Implementations/Middleware/`                                            |
| **RateLimit.Default**         | ✅ Done | `backends/dotnet/shared/Implementations/Middleware/` (uses abstracted cache handlers)           |
| **Handler.Extensions**        | ✅ Done | `backends/dotnet/shared/Handler.Extensions/` (JWT/auth extensions)                              |
| **Errors.Pg**                 | ✅ Done | `backends/dotnet/shared/Implementations/Repository/Errors/Errors.Pg/` (PG error code helpers)   |
| **Geo.Client**                | ✅ Done | `backends/dotnet/services/Geo/Geo.Client/` (includes WhoIs cache handler)                       |

### Shared Packages (Node.js)

> Mirrors .NET shared project structure under `backends/node/shared/`. All packages use `@d2/` scope.
> Workspace root is at project root (`D2-WORX/`) — SvelteKit and other clients can consume any `@d2/*` package.

| Package                    | Status     | Location                                                                      | .NET Equivalent                            |
| -------------------------- | ---------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| **@d2/result**             | ✅ Done    | `backends/node/shared/result/`                                                | `D2.Shared.Result`                         |
| **@d2/utilities**          | ✅ Done    | `backends/node/shared/utilities/`                                             | `D2.Shared.Utilities`                      |
| **@d2/protos**             | ✅ Done    | `backends/node/shared/protos/`                                                | `Protos.DotNet`                            |
| **@d2/testing**            | ✅ Done    | `backends/node/shared/testing/`                                               | `D2.Shared.Tests` (infra)                  |
| **@d2/shared-tests**       | ✅ Done    | `backends/node/shared/tests/`                                                 | `D2.Shared.Tests` (tests)                  |
| **@d2/logging**            | ✅ Done    | `backends/node/shared/logging/`                                               | `Microsoft.Extensions.Logging` (ILogger)   |
| **@d2/service-defaults**   | ✅ Done    | `backends/node/shared/service-defaults/`                                      | `D2.Shared.ServiceDefaults`                |
| **@d2/handler**            | ✅ Done    | `backends/node/shared/handler/`                                               | `D2.Shared.Handler`                        |
| **@d2/interfaces**         | ✅ Done    | `backends/node/shared/interfaces/`                                            | `D2.Shared.Interfaces`                     |
| **@d2/result-extensions**  | ✅ Done    | `backends/node/shared/result-extensions/`                                     | `D2.Shared.Result.Extensions`              |
| **@d2/cache-memory**       | ✅ Done    | `backends/node/shared/implementations/caching/in-memory/default/`             | `InMemoryCache.Default`                    |
| **@d2/cache-redis**        | ✅ Done    | `backends/node/shared/implementations/caching/distributed/redis/`             | `DistributedCache.Redis`                   |
| **@d2/messaging**          | ✅ Done    | `backends/node/shared/messaging/`                                             | Messaging.RabbitMQ (raw AMQP + proto JSON) |
| **@d2/geo-client**         | ✅ Done    | `backends/node/services/geo/geo-client/`                                      | `Geo.Client` (full parity)                 |
| **@d2/request-enrichment** | ✅ Done    | `backends/node/shared/implementations/middleware/request-enrichment/default/` | `RequestEnrichment.Default`                |
| **@d2/ratelimit**          | ✅ Done    | `backends/node/shared/implementations/middleware/ratelimit/default/`          | `RateLimit.Default`                        |
| **@d2/idempotency**        | ✅ Done    | `backends/node/shared/implementations/middleware/idempotency/default/`        | `Idempotency.Default`                      |
| **@d2/di**                 | ✅ Done    | `backends/node/shared/di/`                                                    | `Microsoft.Extensions.DependencyInjection` |
| **@d2/batch-pg**           | ✅ Done    | `backends/node/shared/implementations/repository/batch/pg/`                   | `Batch.Pg`                                 |
| **@d2/errors-pg**          | ✅ Done    | `backends/node/shared/implementations/repository/errors/pg/`                  | `Errors.Pg`                                |
| **@d2/comms-client**       | ✅ Done    | `backends/node/services/comms/client/`                                        | — (RabbitMQ notification publisher)        |
| **@d2/auth-bff-client**    | ✅ Done    | `backends/node/services/auth/bff-client/`                                     | — (BFF client, HTTP — no .NET equivalent)  |
| **@d2/auth-client**        | 📋 Phase 2 | `backends/node/services/auth/client/`                                         | `Auth.Client` (gRPC, service-to-service)   |

### Services

| Service           | Status         | Notes                                                                                                            |
| ----------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Geo.Domain        | ✅ Done        | Entities, value objects                                                                                          |
| Geo.App           | ✅ Done        | CQRS handlers, mappers                                                                                           |
| Geo.Infra         | ✅ Done        | Repository, messaging                                                                                            |
| Geo.API           | ✅ Done        | gRPC service                                                                                                     |
| Geo.Client        | ✅ Done        | Service-owned client library (messages, interfaces, handlers)                                                    |
| Geo.Tests         | ✅ Done        | 759 tests passing                                                                                                |
| **Auth Service**  | 🚧 In Progress | Node.js + Hono + BetterAuth (`backends/node/services/auth/`). Stage B done + invitation email delivery + E2E     |
| **Auth.Tests**    | 🚧 In Progress | Auth service tests (`backends/node/services/auth/tests/`) — 922 tests passing                                    |
| **Comms Service** | 🚧 In Progress | Node.js delivery engine (`backends/node/services/comms/`). Phase 1 done (email + SMS + gRPC + RabbitMQ consumer) |
| **Comms.Tests**   | 🚧 In Progress | Comms service tests (`backends/node/services/comms/tests/`) — 592 tests passing                                  |

### Gateways

| Gateway         | Status     | Notes                                                    |
| --------------- | ---------- | -------------------------------------------------------- |
| REST Gateway    | ✅ Done    | HTTP/REST → gRPC with request enrichment + rate limiting |
| SignalR Gateway | 📋 Planned | WebSocket → gRPC                                         |

### Frontend

| Component            | Status         | Notes                                                                   |
| -------------------- | -------------- | ----------------------------------------------------------------------- |
| SvelteKit App        | 🚧 In Progress | Steps 0–8 done (design, routing, auth BFF, gateway, forms, auth pages) |
| Auth BFF Integration | ✅ Done        | Proxy, session resolver, JWT manager, route guards (ADR-017)            |
| API Gateway Client   | ✅ Done        | Server-side + client-side, camelCase normalizer (ADR-005)               |
| Server Middleware    | ✅ Done        | Request enrichment, rate limiting, idempotency on SvelteKit             |
| OpenTelemetry        | ✅ Done        | Server instrumentation. Client telemetry (Faro) pending Step 9          |

---

## Architecture Decisions

### ADR-001: Authentication Architecture

**Status**: Decided (2025-02), expanded (2026-02-05)

**Context**: Need authentication across multiple services (SvelteKit, .NET gateways, future Node.js services). Must be horizontally scalable — multiple instances of any service can run across different locations behind load balancers, sharing Redis + PostgreSQL.

**Decision**:

- **Auth Service**: Standalone Node.js + Hono + BetterAuth (source of truth)
- **SvelteKit**: Proxy pattern (`/api/auth/*` → Auth Service)
- **.NET Gateways**: JWT validation via JWKS endpoint
- **Request flow**: Hybrid Pattern C (see ADR-005)

#### Session Management (3-Tier Storage)

```
┌─────────────────────────────────────────────────────┐
│  Cookie Cache (5min, compact strategy)              │
│  → Eliminates ~95% of storage lookups               │
│  → Decoded locally, zero network calls              │
├─────────────────────────────────────────────────────┤
│  Redis (secondary storage)                          │
│  → Fast session lookups + near-instant revocation   │
│  → Keys: {token} → {session,user} JSON              │
│  → Active sessions: active-sessions-{userId}        │
├─────────────────────────────────────────────────────┤
│  PostgreSQL (storeSessionInDatabase: true)           │
│  → Audit trail, durability, fallback if Redis down  │
└─────────────────────────────────────────────────────┘
```

**Session config:**

- `expiresIn`: 7 days
- `updateAge`: 1 day (auto-refresh on activity)
- `cookieCache.maxAge`: 5 minutes (the revocation lag window)
- `cookieCache.strategy`: `"compact"` (base64url + HMAC-SHA256, smallest size)

**Session revocation** (all OOTB from BetterAuth):

- `revokeSession({ token })` — kill a specific session
- `revokeOtherSessions()` — "sign out everywhere else"
- `revokeSessions()` — kill all sessions
- `changePassword({ revokeOtherSessions: true })` — revoke on password change
- Individual session revocation supported via server-side API when token not available from `listSessions()`

**Caveat:** With cookie cache enabled, a revoked session may remain valid on the device that has it cached until the cookie cache expires (~5 minutes max). This is acceptable for our use case.

#### JWT Configuration (for .NET Gateway validation)

- **Algorithm**: RS256 (native .NET support via `Microsoft.IdentityModel.Tokens`, no extra packages)
- **Expiration**: 15 minutes (BetterAuth default)
- **JWKS endpoint**: `/api/auth/jwks`
- **Key rotation**: 30-day intervals with 30-day grace period
- **Issuer/Audience**: Configured per environment
- **Custom claims**: User ID, email, name, roles (via `definePayload`)

**Why RS256 over EdDSA (BetterAuth default):** `Microsoft.IdentityModel.Tokens` doesn't natively support EdDSA — would require `ScottBrady.IdentityModel` wrapping Bouncy Castle. RS256 works with standard `AddJwtBearer()`.

#### BetterAuth Plugins

| Plugin   | Purpose                                                    |
| -------- | ---------------------------------------------------------- |
| `bearer` | Session token via `Authorization` header (for API clients) |
| `jwt`    | Issues 15min RS256 JWTs for service-to-service auth        |

**Important distinction:** The Bearer plugin uses the _session token_ (opaque, validated via DB/Redis lookup). The JWT plugin issues _signed JWTs_ (stateless, validated via JWKS public key). They serve different purposes and are both needed.

#### Horizontal Scaling

This architecture requires **no sticky sessions**:

- Cookie cache: session data travels with the request (decoded locally)
- Redis: shared session store any instance can query
- JWTs: self-contained, any instance can validate with cached public key
- New instances/locations just point at the same shared Redis + PG

**Rationale**:

- Single source of truth for auth logic
- SvelteKit retains normal BetterAuth DX (`createAuthClient` works as-is)
- Stateless JWT validation for .NET services (no BetterAuth dependency)
- Horizontally scalable — no sticky sessions, no instance affinity
- 3-tier session storage balances performance, revocability, and durability

**Consequences**:

- SvelteKit needs proxy configuration in `hooks.server.ts`
- .NET gateways need JWT validation middleware (`Microsoft.IdentityModel.Tokens` + `AddJwtBearer`)
- Auth Service must expose `/api/auth/jwks` endpoint
- .NET gateway must be publicly accessible (for direct client-side API calls, see ADR-005)
- CORS must be configured on the .NET gateway for the SvelteKit origin
- Client-side needs a JWT manager utility (obtain, cache in memory, auto-refresh before 15min expiry)

---

### ADR-002: Rate Limiting Strategy

**Status**: Decided (2025-02)

**Context**: Need rate limiting across multiple gateways (REST, SignalR, SvelteKit) with protection against distributed attacks.

**Decision**:

- **Storage**: Redis (shared across all services)
- **Dimensions**: IP, userId, fingerprint, city, country
- **Logic**: If ANY dimension exceeds threshold → block ALL dimensions for that request
- **Thresholds**: Two tiers (anonymous: lower, authenticated: higher)
- **Response**: 429 + structured logging + alerting

**Packages**:

- `@d2/ratelimit` (Node.js) - for Auth Service, SvelteKit
- `D2.RateLimit.Redis` (C#) - for .NET gateways

**Key Format**:

```
ratelimit:{dimension}:{value}:{window}
blocked:{dimension}:{value}
```

**Rationale**:

- Multi-dimensional catches attackers spreading across IPs/fingerprints
- Redis enables cross-service rate limit state
- "Any exceeds" logic prevents dimension hopping

---

### ADR-003: Geo Data Caching Strategy

**Status**: Decided (2025-02)

**Context**: Rate limiter needs city/country from Geo service. Calling Geo service on every request is inefficient.

**Decision**:

- Local memory cache packages for WhoIs data
- `@d2/geo-client` FindWhoIs handler (Node.js), `D2.Geo.Cache` (C#)
- LRU cache with configurable TTL, configurable entry limit
- Cache miss → gRPC call to Geo service

**Rationale**:

- IP→Geo mapping changes infrequently
- Local cache avoids network hop for hot IPs
- Geo service still source of truth

---

### ADR-004: Fingerprinting Approach

**Status**: Decided (2025-02)

**Context**: Need fingerprinting for rate limiting, but must consider security/privacy tradeoffs.

**Decision**:

- **Primary**: Server-side fingerprint (User-Agent, Accept-Language, Accept-Encoding, Accept headers)
- **Optional**: Client-side FingerprintJS (sent as `X-Fingerprint` header)
- **Usage**: One of several rate limit dimensions, not sole identifier

**IP Resolution Order**:

1. `CF-Connecting-IP` (Cloudflare)
2. `X-Real-IP` (standard proxy)
3. `X-Forwarded-For` (first IP)
4. Socket remote address

**Rationale**:

- Server-side fingerprint adds friction for attackers
- Not perfect, but combined with other signals is valuable
- Client-side optional for higher-security scenarios

---

### ADR-005: Request Flow Pattern (Hybrid BFF + Direct Gateway)

**Status**: Decided (2026-02-05)

**Context**: Need to determine how browser clients interact with backend services. Three options: (A) all traffic through SvelteKit, (B) all API traffic direct to gateway, (C) hybrid.

**Decision**: **Pattern C — Hybrid**

Two request paths coexist:

```
Path 1 — SSR + slow-changing data (via SvelteKit server):
  Browser ──cookie──► SvelteKit Server ──JWT──► .NET Gateway ──gRPC──► Services

Path 2 — Interactive client-side fetches (direct to gateway):
  Browser ──JWT──► .NET Gateway ──gRPC──► Services

Auth (always proxied):
  Browser ──cookie──► SvelteKit ──proxy──► Auth Service
```

**Path 1** is for: initial page loads, SEO-critical content, geo reference data, anything that benefits from SSR or SvelteKit-layer caching. SvelteKit server obtains/caches a JWT and calls the gateway on the user's behalf.

**Path 2** is for: search-as-you-type, form submissions, real-time data, anything where the extra hop through SvelteKit would hurt perceived responsiveness. Browser obtains a JWT via `authClient.token()` (proxied through SvelteKit to the Auth Service) and calls the gateway directly.

**Client-side JWT lifecycle:**

1. `authClient.token()` obtains a 15min RS256 JWT
2. Stored in memory only (never localStorage — XSS risk)
3. Auto-refresh ~1 minute before expiry
4. Exposed via a utility function (e.g., `getToken()`) for use in fetch calls

**Rationale**:

- Better UX for interactive features (eliminates SvelteKit hop for API calls)
- SSR still works for initial loads and SEO
- Established pattern used in production by many teams
- Gateway's request enrichment + rate limiting works identically for both paths
- No architectural redesign needed — just opens the gateway to direct client traffic

**Consequences**:

- .NET gateway must be publicly accessible (e.g., `api.d2worx.dev`)
- CORS configuration required on the gateway (accept SvelteKit origin, credentials: true)
- Client needs a JWT manager utility (Svelte store/module)
- Two auth validation paths to maintain (SvelteKit server + direct browser)
- SvelteKit `hooks.server.ts` handles both auth proxy and session population

---

### ADR-006: Retry & Resilience Pattern

**Status**: Decided (2026-02-08)

**Context**: Cross-service calls (gRPC, external APIs) can fail transiently. Need a consistent retry strategy across both .NET and Node.js that's opt-in, smart about when to retry, and avoids masking permanent failures.

**Decision**: General-purpose retry utility, opt-in per call site, both platforms.

| Aspect          | Decision                                                              |
| --------------- | --------------------------------------------------------------------- |
| Scope           | General-purpose utility, usable for gRPC + external HTTP APIs         |
| Activation      | Opt-in — not all calls should retry (e.g., validation failures)       |
| Strategy        | Exponential backoff: 1s → 2s → 4s → 8s (configurable)                 |
| Max attempts    | 4 retries (5 total attempts, configurable)                            |
| Retry triggers  | Transient only: 5xx, timeout, connection refused, 429 (rate limited)  |
| No retry        | 4xx (validation, auth, not found) — these are permanent failures      |
| Jitter          | Add random jitter to avoid thundering herd                            |
| Circuit breaker | Not initially — evaluate if needed after real traffic patterns emerge |

**Key design principles:**

- **Smart transient detection**: The retrier inspects the error/status code to determine if retry is appropriate. gRPC `UNAVAILABLE`, `DEADLINE_EXCEEDED`, `RESOURCE_EXHAUSTED` → retry. `INVALID_ARGUMENT`, `NOT_FOUND`, `PERMISSION_DENIED` → no retry.
- **Caller controls retry budget**: Each call site decides max attempts and backoff. Critical path (e.g., contact creation during sign-up) might use aggressive retry (4 attempts). Non-critical path (e.g., analytics ping) might use 1-2 attempts or none.
- **Fail loudly after exhaustion**: When retries are exhausted, propagate the last error. Do not swallow failures.

**Packages**: Utility function in both `@d2/utilities` (Node.js) and `D2.Shared.Utilities` (.NET). Not a middleware — a composable function that wraps any async operation.

**Rationale**:

- Polly-style libraries are overkill for our current needs — a focused retry function is simpler
- Opt-in prevents accidental retry of non-idempotent operations
- Exponential backoff with jitter is industry standard for distributed systems
- Same pattern on both platforms reduces cognitive overhead

---

### ADR-007: Idempotency Middleware

**Status**: Implemented (2026-02-09)

**Context**: External-facing mutation endpoints (sign-up, form submissions, payments) are vulnerable to duplicate requests from double-clicks, network retries, or client bugs. Need a general-purpose idempotency pattern for both .NET gateway and auth service.

**Decision**: `Idempotency-Key` header middleware on external-facing endpoints.

**How it works:**

1. Client generates a UUID and sends it as `Idempotency-Key` header with mutation requests
2. Server middleware checks Redis for the key before executing the handler
3. If key exists → return cached response (status code + body) without re-executing
4. If key doesn't exist → execute handler, cache response in Redis with TTL, return response
5. TTL: 24 hours (configurable) — long enough for client retries, short enough to not bloat Redis

**Key design decisions:**

| Aspect            | Decision                                                                           |
| ----------------- | ---------------------------------------------------------------------------------- |
| Header name       | `Idempotency-Key` (industry standard, used by Stripe, PayPal, etc.)                |
| Key format        | Client-generated UUID (v4 or v7)                                                   |
| Storage           | Redis (shared across instances)                                                    |
| TTL               | 24 hours (configurable)                                                            |
| Scope             | External-facing mutation endpoints only (not internal gRPC)                        |
| Required?         | Optional header — endpoints work without it, but duplicate protection only with it |
| Conflict handling | If a request with the same key is in-flight, return 409 Conflict                   |
| Cache content     | HTTP status code + response body (serialized)                                      |

**Where applied:**

- **.NET gateway**: Middleware on POST/PUT/PATCH/DELETE routes
- **Auth service (Hono)**: Middleware on sign-up, org creation, invitation endpoints
- **NOT on**: Internal gRPC calls (these use retry + domain-level deduplication instead)

**Redis key format:** `idempotency:{service}:{key}` (e.g., `idempotency:auth:550e8400-e29b-41d4-a716-446655440000`)

**Rationale**:

- Industry-standard pattern (Stripe, PayPal, Google APIs)
- Separate from retry logic — retries happen at the caller, idempotency at the server
- Redis storage enables cross-instance deduplication
- Optional header means no breaking change for existing clients

---

### ADR-008: Sign-Up Flow & Cross-Service Ordering

**Status**: Decided (2026-02-08)

**Context**: Sign-up involves creating a user (BetterAuth/auth service) and a contact (Geo service). If the user is created first but the contact fails, we have a "stale user" — a user record with no associated contact data. This is problematic because the entire system assumes contact info is always present for a user.

**Decision**: **Contact BEFORE user** — create the Geo contact first, then create the user in BetterAuth.

**Flow:**

```
1. Validate all input (email, name, password, etc.)
2. Pre-generate UUIDv7 for the new user ID
3. Create Geo Contact with relatedEntityId = pre-generated userId
   └─ If Geo unavailable → FAIL sign-up entirely (retry with backoff first)
   └─ Orphaned contact is harmless if user creation later fails
4. Create user in BetterAuth with the pre-generated ID
   └─ If BetterAuth fails → orphaned contact exists but is harmless noise
5. Send welcome/verification email via RabbitMQ (async, fire-and-forget)
6. Return session to client
```

**Key decisions:**

| Aspect                                 | Decision                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| ID format                              | UUIDv7 everywhere (time-ordered, `.NET: Guid.CreateVersion7()`, Node: `uuid` v7)    |
| Pre-generated IDs                      | Yes — userId generated before any service call, passed to both Geo and BetterAuth   |
| Geo unavailable                        | Fail sign-up entirely (after retry with exponential backoff)                        |
| BetterAuth fails after contact created | Orphaned contact is harmless — no cleanup needed                                    |
| Race conditions (duplicate email)      | DB unique constraint on `user.email` is sufficient — no distributed locks           |
| Orphaned contacts                      | Harmless noise — can be cleaned up by periodic job if desired                       |
| Email notifications                    | Async via RabbitMQ (eventual delivery, survives temp notification service downtime) |

**BetterAuth custom ID support** (researched 2026-02-08):

BetterAuth supports programmer-defined IDs via two mechanisms:

1. **`advanced.database.generateId`**: Global function `({ model, size }) => string` called for ALL BetterAuth tables. Set this to return UUIDv7 for all models. This replaces BetterAuth's default ID generation (nanoid/cuid) with our UUIDv7s.

2. **`databaseHooks.user.create.before`**: Per-request hook that can inject a specific pre-generated ID:
   ```typescript
   databaseHooks: {
     user: {
       create: {
         before: async (user) => {
           const preId = getPreGeneratedId(); // from request context
           return { data: { ...user, id: preId }, forceAllowId: true };
         };
       }
     }
   }
   ```
   The `forceAllowId: true` flag is required to override BetterAuth's default ID generation per-request.

**Recommended approach**: Use `generateId` for global UUIDv7 on all tables. Use `databaseHooks.user.create.before` + `forceAllowId` for injecting the pre-generated userId during sign-up (the ID that was already used to create the Geo contact).

**Passing pre-generated ID to BetterAuth**: The sign-up handler sets the pre-generated ID in a request-scoped context (Hono `c.set("preGeneratedUserId", id)`) before calling `auth.api.signUpEmail()`. The `before` hook reads it from the same context.

**GitHub references:**

- Issue [#2881](https://github.com/better-auth/better-auth/issues/2881): Confirms `forceAllowId` works (fixed July 2025)
- Issue [#1060](https://github.com/better-auth/better-auth/issues/1060): Maintainers note persistence in hooks is an "anti-pattern", but `forceAllowId` addresses the ID generation use case
- Issue [#2098](https://github.com/better-auth/better-auth/issues/2098): Hooks not respecting returned data — fixed

**Rationale**:

- Eliminates "stale user" problem entirely — worst case is an orphaned contact (harmless)
- UUIDv7 provides time-ordering for database performance (B-tree friendly)
- Pre-generating IDs enables contact-before-user without BetterAuth changes
- `forceAllowId` is the official mechanism for custom ID injection
- DB unique constraint on email is sufficient for race conditions — simpler than distributed locks

---

### ADR-009: Drizzle ORM for Auth Database (Replacing Kysely)

**Status**: Decided (2026-02-15)

**Context**: The auth service initially used Kysely for 3 custom tables (`sign_in_event`, `emulation_consent`, `org_contact`) while BetterAuth used its built-in Kysely adapter internally. This meant two ORMs operating side-by-side — BetterAuth's internal Kysely for its 8 managed tables, and our explicit Kysely for custom tables. Migrations were hand-written with no programmatic runner.

**Decision**: **Drizzle ORM 0.45.x** (stable) as the single ORM for all 11 auth tables.

**Key changes:**

| Aspect                   | Before (Kysely)                                     | After (Drizzle 0.45.x)                                              |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------- |
| BetterAuth adapter       | Built-in Kysely (internal)                          | `drizzleAdapter(db, { provider: "pg", schema })`                    |
| Custom table schema      | Hand-written `kysely-types.ts`                      | `pgTable()` declarations with `$inferSelect`/`$inferInsert`         |
| BetterAuth table schema  | Managed internally by BetterAuth                    | Explicit `pgTable()` declarations matching BetterAuth CLI output    |
| Migration generation     | Hand-written TS files                               | `drizzle-kit generate` from schema diffs                            |
| Migration runner         | None (files existed but no runner)                  | Programmatic `runMigrations(pool)` for app startup + Testcontainers |
| Repository query builder | `Kysely<AuthCustomDatabase>`                        | `NodePgDatabase` + Drizzle query builder                            |
| Column naming            | snake_case (manual)                                 | camelCase JS props → snake_case DB columns (Drizzle convention)     |
| Number of ORMs           | 2 (Kysely explicit + Kysely internal to BetterAuth) | 1 (Drizzle everywhere)                                              |

**Schema files:**

- `infra/src/repository/schema/better-auth-tables.ts` — 8 BetterAuth tables (user, session, account, verification, jwks, organization, member, invitation)
- `infra/src/repository/schema/custom-tables.ts` — 3 custom tables (sign_in_event, emulation_consent, org_contact)
- `infra/drizzle.config.ts` — Points at both schema files, generates to `src/repository/migrations/`

**Rationale:**

- Single ORM eliminates the two-ORM complexity
- Auto-generated migrations from schema diffs (no hand-written SQL)
- Programmatic migration runner enables Testcontainers integration tests
- `$inferSelect`/`$inferInsert` types derived directly from schema (no manual type duplication)
- Drizzle 0.45.x is stable; v1 beta is incompatible with BetterAuth's adapter

**Supersedes**: The Kysely decision in ADR-001's research notes (line "BetterAuth database adapter: Kysely").

---

### ADR-010: Reserved

---

### ADR-011: Lightweight DI Container (`@d2/di`)

**Status**: Implemented (2026-02-21)

**Context**: The Node.js services used manual factory functions (`createXxxHandlers(deps, context)`) for dependency injection, as decided in the Phase 2 research (2026-02-07). While functional at small scale, this approach had growing pain points as auth and comms services expanded:

- Composition roots manually wired 30+ handlers with explicit dependency threading
- Per-request scoping required ad-hoc patterns (Hono `c.var`, function closures)
- No lifetime management — no distinction between singleton, scoped, and transient services
- Handler `traceId` boilerplate: every handler had to pass `traceId: this.traceId` to D2Result (174 occurrences)

**Decision**: Build `@d2/di` — a lightweight DI container mirroring .NET's `IServiceCollection`/`IServiceProvider` with `ServiceKey<T>` branded tokens for type-safe resolution.

**Core types:**

| Type                | .NET Equivalent      | Purpose                                                                                               |
| ------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- |
| `ServiceKey<T>`     | —                    | Branded runtime token (replaces erased TS interfaces as DI keys)                                      |
| `ServiceCollection` | `IServiceCollection` | Registration builder — `addSingleton`, `addScoped`, `addTransient`, `addInstance`                     |
| `ServiceProvider`   | `IServiceProvider`   | Immutable resolver — `resolve<T>(key)`, `tryResolve<T>(key)`, `createScope()`                         |
| `ServiceScope`      | `IServiceScope`      | Per-request child scope — caches scoped services, `setInstance()` for overrides, `[Symbol.dispose]()` |
| `Lifetime`          | `ServiceLifetime`    | Enum: `Singleton`, `Scoped`, `Transient`                                                              |

**Resolution rules (matching .NET exactly):**

- **Singleton**: Cached once in root, shared across all scopes. Factory receives root provider (captive dependency prevention)
- **Scoped**: Cached per scope (typically per-request). Throws when resolved from root. Factory receives scope provider
- **Transient**: New instance every `resolve()`. Factory receives current provider (root or scope)

**Registration pattern:**

Each service package exports an `addXxx(services, ...)` registration function that mirrors .NET's `services.AddXxx()`:

- `addAuthInfra(services, db)` — 14 transient repo handlers
- `addAuthApp(services, options)` — 17 transient CQRS + notification handlers
- `addCommsInfra(services, db, providerConfig)` — infra handlers + email/SMS providers
- `addCommsApp(services)` — delivery handlers

`ServiceKey` constants are co-located with their interfaces (e.g., `IRecordSignInEventKey` next to the handler interface in `@d2/auth-app`).

**Scoping patterns:**

- **Auth (HTTP)**: `createScopeMiddleware(provider)` on protected routes — builds `IRequestContext` from session data, sets `IHandlerContext` in scope. Routes resolve handlers via `c.get("scope").resolve(key)`. BetterAuth callbacks use `createCallbackScope()` (temporary scope with service-level context)
- **Comms (gRPC)**: Per-RPC scope in gRPC service handlers — `createServiceScope(provider)` with fresh traceId
- **Comms (RabbitMQ)**: Per-message scope in consumer callback — same `createServiceScope(provider)` pattern

**BaseHandler traceId auto-injection:**

`BaseHandler.handleAsync()` now automatically injects the ambient `traceId` from `IHandlerContext` into any `D2Result` that doesn't already have one. This eliminated 174 occurrences of `traceId: this.traceId` across all handler return sites.

**Package location**: `backends/node/shared/di/` (`@d2/di`). Layer 0 — zero project dependencies.

**Rationale:**

- Mirrors .NET's DI patterns (reduces cognitive overhead for polyglot developers)
- Lifetime management prevents captive dependency bugs (singleton depending on scoped)
- `ServiceKey<T>` provides compile-time type safety without runtime reflection
- Per-request scoping enables proper `IRequestContext` isolation (traceId, user context)
- Registration functions (`addXxxApp`, `addXxxInfra`) provide the same composability as .NET extension methods
- ~200 lines of code — no external dependencies, fully testable

**Supersedes**: The manual factory function pattern from the Phase 2 DI research decision (2026-02-07). Factory functions are replaced by `ServiceCollection` registrations + `ServiceProvider` resolution.

---

### ADR-012: Service-to-Service Trust (S2S)

**Status**: Implemented (2026-02)

**Context**: Backend services need to call each other (e.g., Dkron → Gateway → Geo for scheduled jobs). These calls should bypass rate limiting and fingerprint validation — they're trusted internal traffic, not browser requests. Need a mechanism to establish trust without coupling services to each other's auth systems.

**Decision**: `X-Api-Key` header validated by `ServiceKeyMiddleware`, setting an `IsTrustedService` flag that downstream middleware and endpoint filters can check.

**Mechanism:**

| Aspect               | Decision                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Header               | `X-Api-Key` (single shared key for all services)                                                  |
| Middleware            | `ServiceKeyMiddleware` — runs early in pipeline, validates header against configured key           |
| Trust flag            | `IRequestInfo.IsTrustedService` — set by middleware, consumed by downstream components            |
| Invalid key           | 401 immediately (fail fast, before rate limiting)                                                 |
| No key                | Treated as browser request, continues normally through full pipeline                              |
| Pipeline order        | RequestEnrichment → ServiceKeyDetection → RateLimiting → Auth → Fingerprint → Authz             |
| Endpoint filter       | `RequireServiceKey()` on endpoints checks `IsTrustedService` flag (no re-validation)             |

**Design principle**: Service key = TRUST (bypasses security layers). JWT = IDENTITY (carries user context). They are independent — a request can have both, either, or neither.

**Trusted service bypasses:**

- Rate limiting — all dimensions skipped (early return in Check handler)
- JWT fingerprint validation — skipped entirely

**Rationale:**

- Simple and effective for dev/pre-prod environments with a single shared key
- Clear separation of trust (service key) and identity (JWT)
- Fail-fast on invalid key prevents wasting resources on malicious requests
- `IsTrustedService` flag is a clean abstraction — no tight coupling between middleware layers

**Future considerations:** Per-service keys, mTLS, or service mesh for production hardening.

---

### ADR-013: Scheduled Jobs (Dkron)

**Status**: Implemented (2026-02)

**Context**: Multiple services need periodic data maintenance (purging expired sessions, cleaning stale WhoIs data, removing soft-deleted messages). Need a distributed job scheduler that works with the existing Aspire infrastructure and supports the handler pattern.

**Decision**: **Dkron 4.0.9** as the scheduler with `@d2/dkron-mgr` as a declarative job reconciler. Jobs execute via HTTP→gRPC chain through the .NET REST gateway.

**Architecture:**

```
Dkron (cron) → HTTP POST to REST Gateway (X-Api-Key)
  → Gateway forwards via gRPC (API key via AddCallCredentials)
    → Service handler acquires Redis lock (SET NX PX)
      → Batch delete loop
        → Returns result
```

**Key components:**

| Component        | Role                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| Dkron 4.0.9      | Persistent Aspire container, dashboard at `:8888`, single-node Raft              |
| `@d2/dkron-mgr`  | Node.js reconciler — declarative job definitions → Dkron REST API                |
| REST Gateway     | Receives Dkron HTTP callbacks, forwards via gRPC with service key auth           |
| Service handlers | App-layer CQRS handlers with Redis distributed locks and batch delete operations |

**Job execution flow:**

1. Dkron fires HTTP POST to REST Gateway endpoint
2. Gateway validates `X-Api-Key` header (service key auth)
3. Gateway calls target service via gRPC (API key passed via `AddCallCredentials`)
4. Service handler acquires Redis distributed lock (`SET NX PX`) to prevent concurrent execution
5. Handler performs batch deletes in configurable chunk sizes
6. Returns result (deleted count, lock status)

**`@d2/dkron-mgr` reconciler:**

- Declarative job definitions (cron schedule, endpoint URL, metadata)
- Drift detection — compares desired state against Dkron REST API
- Orphan cleanup — removes jobs not in the desired state
- Idempotent reconciliation loop — safe to run repeatedly
- 64 tests (unit + integration + E2E)

**`handleJobRpc()` utility**: Shared helper in `@d2/service-defaults` that wraps a gRPC job handler with distributed lock acquisition, timeout handling, and structured logging.

**Lock pattern**: Each job handler acquires a Redis lock with configurable TTL via Options pattern. Returns early if lock held by another instance. Lock is released on completion.

**Env vars**: `DKRON_MGR__DKRON_URL`, `DKRON_MGR__GATEWAY_URL`, `DKRON_MGR__SERVICE_KEY` — all in `.env.local`.

**Job schedule (8 daily jobs, staggered 15 min apart, 2:00–3:45 AM UTC):**

| Job                                 | Owner | Schedule    | Retention | Notes                                                                                        |
| ----------------------------------- | ----- | ----------- | --------- | -------------------------------------------------------------------------------------------- |
| **Purge stale WhoIs**               | Geo   | Daily 02:00 | 180 days  | `geo-purge-stale-whois` — BatchDelete by cutoff year/month. Runs BEFORE location cleanup     |
| **Cleanup orphaned locations**      | Geo   | Daily 02:15 | N/A       | `geo-cleanup-orphaned-locations` — DELETE locations with zero contact + zero WhoIs references |
| **Purge expired sessions (PG)**     | Auth  | Daily 02:30 | 0 days    | `auth-purge-sessions` — DELETE `session` WHERE `expires_at < NOW()`                          |
| **Purge sign-in events**            | Auth  | Daily 02:45 | 90 days   | `auth-purge-sign-in-events` — batch delete via `batchDelete()`                               |
| **Cleanup expired invitations**     | Auth  | Daily 03:00 | 7 days    | `auth-cleanup-invitations` — DELETE expired invitations past retention grace period           |
| **Cleanup emulation consents**      | Auth  | Daily 03:15 | 0 days    | `auth-cleanup-emulation-consents` — DELETE WHERE expired OR revoked                          |
| **Purge soft-deleted messages**     | Comms | Daily 03:30 | 90 days   | `comms-purge-deleted-messages` — batch delete messages past retention                        |
| **Purge delivery history**          | Comms | Daily 03:45 | 365 days  | `comms-purge-delivery-history` — batch delete old delivery_request + delivery_attempt rows   |

**Items already handled by existing TTL/eviction (no Dkron job needed):**

- Idempotency keys: Redis TTL (24h)
- Rate limit counters/blocks: Redis TTL
- Redis cache entries: Redis TTL + LRU eviction
- In-memory cache: Lazy TTL + LRU eviction
- Comms delivery retries: RabbitMQ DLX + tier queue TTLs
- JWKS key rotation: BetterAuth-managed
- BetterAuth verification tokens: Lazy bulk-delete on any `findVerificationValue` call (since v1.2.0)

**Rationale:**

- Dkron is a lightweight, Raft-based scheduler that fits the Aspire container model
- Reconciler pattern ensures job definitions are version-controlled and drift-resistant
- HTTP→gRPC chain reuses existing gateway infrastructure and auth patterns
- Redis distributed locks prevent concurrent job execution across instances
- Batch delete pattern avoids long-running transactions

---

### ADR-014: Comms Delivery Engine

**Status**: Implemented (2026-02, Phase 1)

**Context**: D²-WORX needs a communications service for transactional notifications (email verification, password reset, invitation emails) and eventually conversational messaging (threads, chat, forums). The old DeCAF system used PG polling with Quartz cron for retries — slow and fragile.

**Decision**: Standalone Node.js delivery engine (`@d2/comms-api`) consuming from RabbitMQ, with a thin publisher client (`@d2/comms-client`) for senders.

**Universal message shape:**

All notifications use a single `NotifyInput` shape — no per-event templates, no event-specific sub-handlers:

| Field                | Type                     | Required | Description                                       |
| -------------------- | ------------------------ | -------- | ------------------------------------------------- |
| `recipientContactId` | `string` (UUID)          | Yes      | Geo contact ID — the ONLY recipient identifier    |
| `title`              | `string` (max 255)       | Yes      | Email subject, SMS prefix, push title             |
| `content`            | `string` (max 50,000)    | Yes      | Markdown body — rendered to HTML for email        |
| `plaintext`          | `string` (max 50,000)    | Yes      | Plain text — SMS body, email fallback             |
| `sensitive`          | `boolean`                | No       | Default `false`. `true` = email only              |
| `urgency`            | `"normal"` \| `"urgent"` | No       | Default `"normal"`. `"urgent"` bypasses prefs     |
| `correlationId`      | `string` (max 36)        | Yes      | Idempotency key for deduplication                 |
| `senderService`      | `string` (max 50)        | Yes      | Source service identifier (e.g., `"auth"`)        |

**Channel resolution rules:**

1. `sensitive: true` → email ONLY (tokens/PII must not leak via SMS)
2. `urgency: "urgent"` → all channels, bypasses preferences
3. `urgency: "normal"` → respects per-contact channel preferences

**Providers:**

| Channel | Provider   | Notes                                                     |
| ------- | ---------- | --------------------------------------------------------- |
| Email   | Resend     | Markdown → HTML via `marked` + `isomorphic-dompurify`     |
| SMS     | Twilio     | Plain text content, trial mode until 10DLC registration   |
| Push    | SignalR GW | gRPC client → SignalR gateway (future, Phase 2)           |

**RabbitMQ topology:**

- `comms.notifications` fanout exchange — all senders publish here
- DLX-based retry: 5 tier queues with escalating TTLs (5s → 10s → 30s → 60s → 5min)
- Max 10 attempts, then drop with structured error log
- Always ACK original message — retry via re-publish to tier queues

**Key simplifications over DeCAF:**

- No per-event sub-handlers — single Deliver handler handles everything
- No event registry — consumer dispatches directly to Deliver
- No template wrappers — single hardcoded HTML email template
- No quiet hours — channel resolution uses only `sensitive` and `urgency`
- No userId resolution — contactId only (senders resolve userId → contactId before publishing)
- Two urgency levels only: `"normal"` and `"urgent"`

**Rationale:**

- Universal message shape drastically simplifies the sender API (one handler, one shape)
- RabbitMQ DLX retry replaces fragile PG polling from DeCAF
- contactId-only resolution decouples Comms from Auth (no user lookups)
- Fire-and-forget from sender's perspective — Comms handles delivery lifecycle

See [`backends/node/services/comms/COMMS.md`](backends/node/services/comms/COMMS.md) for full details.

---

### ADR-015: SvelteKit Strategy

**Status**: Decided (2026-03-01)

**Context**: Building the D²-WORX web client on SvelteKit 5. Needed to analyze the old DeCAF frontend, identify what to keep/discard, and select libraries for the new architecture. Comprehensive strategy report at [`clients/web/SVELTEKIT_STRATEGY.md`](clients/web/SVELTEKIT_STRATEGY.md).

**Decision**: SvelteKit 5 + Svelte 5 with the following stack:

| Concern              | Library / Approach                                                    |
| -------------------- | --------------------------------------------------------------------- |
| UI components        | shadcn-svelte (Bits UI underneath) — copy-paste, own the code         |
| Forms                | Superforms + Formsnap (Zod integration, progressive enhancement)      |
| Toasts               | svelte-sonner (integrated with shadcn-svelte)                         |
| Phone input          | intl-tel-input (official Svelte 5 wrapper)                            |
| Data tables          | shadcn-svelte data table (wraps @tanstack/table-core)                 |
| Date/time            | Bits UI date components + date-fns                                    |
| Icons                | Lucide (tree-shakeable, shadcn-svelte default)                        |
| Font                 | Gabarito (Google Fonts, weight variations for hierarchy)              |
| Theme                | Dark + Light + System (three-way toggle via mode-watcher)             |
| Styling              | Tailwind CSS v4.1                                                     |
| Address autocomplete | Radar — as a **Geo service backend** concern, not a frontend dep      |
| Real-time            | Browser → .NET SignalR gateway directly (`@microsoft/signalr`)        |
| Client telemetry     | Grafana Faro (errors → Loki, traces → Tempo, Web Vitals → Mimir)     |

**Testing strategy:**

| Layer       | Tool                   | Purpose                              |
| ----------- | ---------------------- | ------------------------------------ |
| Component   | vitest-browser-svelte  | Isolated component tests             |
| E2E         | Playwright             | Full user flow tests                 |
| A11y        | axe-core               | Accessibility validation             |
| Performance | Lighthouse CI          | Web Vitals budgets                   |

**Key architectural decisions:**

- **Address autocomplete is a backend concern** — frontend calls a D2 gateway endpoint, gets `LocationDTO`s in D2 format. Provider (Radar) is swappable at the Geo infra layer. NOT a frontend dependency.
- **Real-time via SignalR direct from browser** (Option A) — SvelteKit stays stateless. Auth via JWT. Connection lifecycle tied to auth state.
- **Design system sprint first** — build kitchen sink/style guide page, make visual decisions in browser before building real pages.

**Rationale:**

- shadcn-svelte provides maximum control (own the code) while maintaining consistency
- Superforms eliminates the custom form system complexity from DeCAF
- Grafana Faro integrates natively with existing LGTM observability stack
- SignalR direct from browser avoids adding WebSocket complexity to SvelteKit

---

### ADR-016: Environment Variable Architecture

**Status**: Implemented (2026-03)

**Context**: The .NET Aspire AppHost had hardcoded configuration values (ports, URLs, connection strings) scattered across `Program.cs`. Node.js services used `process.env` directly with no validation. SvelteKit couldn't use Node.js `--import` flag for early env loading. Needed a consistent, typed, validated approach to environment configuration across all platforms.

**Decision**: Platform-specific typed config systems with Aspire AppHost as the orchestration layer that injects env vars into all services.

**Three layers:**

| Layer              | Platform | Mechanism                                                             |
| ------------------ | -------- | --------------------------------------------------------------------- |
| Aspire AppHost     | .NET     | `Env()`/`EnvInt()` helpers read from `.env.local`, inject into child  |
| Node.js services   | Node     | `defineConfig()` typed schema with `requiredString`/`defaultInt`/etc. |
| SvelteKit          | Node     | `loadEnv()` in `instrumentation.server.ts` (earliest server hook)     |

**Aspire AppHost (`ServiceExtensions.cs`):**

- `Env(name)` / `EnvInt(name, default)` static helpers read from process environment
- AppHost loads `.env.local` via `dotenv.net` at startup
- All hardcoded values extracted into env vars with sensible defaults
- Child services receive env vars via `.WithEnvironment()` on resource builders
- Clean env var names (e.g., `AUTH_HTTP_PORT`, `GATEWAY_GRPC_PORT`) replace Aspire's `services__*` format

**Node.js `defineConfig()` (`@d2/service-defaults`):**

```typescript
const config = defineConfig("auth-service", {
  databaseUrl: requiredParsed(parsePostgresUrl, "AUTH_DATABASE_URL"),
  port: defaultInt(5100, "AUTH_HTTP_PORT", "PORT"),
  grpcPort: optionalInt("AUTH_GRPC_PORT"),
});
```

- Declarative schema — each field is `required`, `default`, or `optional`
- Multi-key support — first non-empty env var wins (fallback keys)
- Aggregate error reporting — collects ALL missing required fields, throws ONE error
- Returns frozen, fully-typed config object
- `optionalSection()` mirrors .NET's `IOptions<T>` with `Configure<T>(section)` pattern

**SvelteKit `loadEnv()`:**

- SvelteKit can't use `--import` flag (Vite manages the Node.js process)
- `loadEnv()` in `instrumentation.server.ts` — earliest hook SvelteKit provides
- Reads `.env.local` and populates `process.env` before any server code runs

**`.env.local` organization:**

- Sections grouped by service: `# === Auth ===`, `# === Geo ===`, etc.
- `.env.local.example` maintained in parity — same structure, placeholder values
- Both files committed (`.env.local` is gitignored, `.example` is tracked)

**Rationale:**

- Type-safe config catches missing env vars at startup, not at runtime
- Single source of truth (`.env.local`) for all services during local development
- Aspire AppHost orchestrates env var injection — services don't read `.env.local` directly
- `defineConfig()` provides .NET-style Options pattern for Node.js services
- Aggregate errors prevent the "fix one, find another" debugging loop

---

### ADR-017: Auth BFF Client Pattern

**Status**: Implemented (2026-03)

**Context**: SvelteKit needs to authenticate users, proxy auth requests to the Auth service, obtain JWTs for gateway calls, and protect routes based on auth state. Running a local BetterAuth instance in SvelteKit would bypass the Auth service's security middleware (rate limiting, fingerprint binding, sign-in event recording).

**Decision**: `@d2/auth-bff-client` — a backend-only HTTP client library for SvelteKit that proxies all auth operations through the Auth service. No BetterAuth dependency in SvelteKit.

**Components:**

| Module             | Purpose                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| `SessionResolver`  | Forwards cookies to Auth service `GET /api/auth/get-session`              |
| `JwtManager`       | Obtains, caches (in memory), and auto-refreshes RS256 JWTs for gateway   |
| `AuthProxy`        | Catch-all proxy for `/api/auth/[...path]` → Auth service                 |
| Route guards       | `requireAuth()`, `requireOrg()`, `redirectIfAuthenticated()` for layouts  |

**Cookie signing behavior:**

BetterAuth cookie values are **signed** (`TOKEN.SIGNATURE`), not raw tokens. The raw token from `auth.api.signInEmail()` works with `Authorization: Bearer` but **cannot** be used as a cookie value — BetterAuth silently returns null for unsigned cookies. This is critical for E2E tests and any code that constructs cookies manually.

**SvelteKit integration points:**

- `hooks.server.ts` — SessionResolver runs on every request, populates `event.locals`
- `/api/auth/[...path]/+server.ts` — AuthProxy catch-all route
- `(auth)/+layout.server.ts` — `redirectIfAuthenticated()` for login/signup pages
- `(onboarding)/+layout.server.ts` — `requireAuth()` for post-signup flows
- `(app)/+layout.server.ts` — `requireOrg()` for org-scoped pages

**JwtManager lifecycle:**

1. First gateway call triggers JWT obtain via Auth service
2. JWT cached in memory (never localStorage — XSS risk)
3. Auto-refresh at ~12 minutes (before 15-minute expiry)
4. Concurrent requests share the same pending refresh promise (dedup)
5. `invalidate()` called on sign-out to clear cache

**Type narrowing:**

```typescript
// After requireAuth() — session and user are guaranteed non-null
const { session, user } = requireAuth(locals);

// After requireOrg() — org fields are guaranteed non-null
const { session } = requireOrg(locals);
session.activeOrganizationId; // string (not string | null)
```

**Testing:** 34 unit tests + 10 E2E integration tests (real Auth service over HTTP).

**Rationale:**

- All auth requests flow through the Auth service's full security pipeline
- No BetterAuth dependency in SvelteKit — only HTTP to the Auth service
- SessionResolver is fail-closed — any error returns null session (safe default)
- JwtManager handles the complexity of token lifecycle in one place
- Route guards provide type-safe narrowing at the layout level

See [`backends/node/services/auth/bff-client/AUTH_BFF_CLIENT.md`](backends/node/services/auth/bff-client/AUTH_BFF_CLIENT.md) for full API reference.

---

### ADR-018: Dependency Update Policy

**Status**: Decided (2026-02)

**Context**: The project spans .NET, Node.js, Go, and containerized infrastructure. Dependencies can drift silently — stale packages accumulate security vulnerabilities, miss performance improvements, and cause version conflicts when new libraries are added. Needed a repeatable process to keep everything current without disrupting active feature work.

**Decision**: Quarterly dependency update cycle with a strict "update before new feature phase" timing rule.

**Cadence**: Quarterly (March, June, September, December). Bump everything to latest stable.

**Scope**:

- .NET SDK/runtime, NuGet packages (`dotnet outdated`)
- Node.js/pnpm packages (`pnpm outdated`, all `@d2/*` + third-party)
- Aspire container image tags (PostgreSQL, Redis, RabbitMQ, Dkron, LGTM stack)
- Dev tooling (ESLint, Prettier, Vitest, TypeScript, Drizzle Kit, Buf)
- BetterAuth (pin exact, test thoroughly — check known gotchas list in AUTH.md for regressions)

**Process**:

1. Run `dotnet outdated` and `pnpm outdated` to identify stale packages
2. Bump in dependency order (shared packages first, then services, then clients)
3. Run full test suites after each tier (.NET: `dotnet test`, Node: `pnpm vitest`)
4. Fix any breakage before proceeding to next tier
5. Update Aspire container image tags, verify orchestration starts cleanly
6. Commit as a single `chore: quarterly dependency update (Q# YYYY)` PR

**Timing rule**: Always do the quarterly bump **before** starting a new major feature phase — especially before pulling in new client-side dependencies (e.g., SvelteKit libraries). This keeps the foundation current and avoids version conflicts with freshly installed packages.

**Rationale**:

- Quarterly cadence balances freshness against update fatigue
- Tiered bumping (shared → services → clients) catches breakage at the source before it propagates
- "Update before feature phase" rule prevents version conflicts when adding new dependencies
- Single PR per quarter keeps the git history clean and makes rollback straightforward
- Exact version pinning (ADR: `.npmrc` `save-exact=true`) means updates are explicit, never implicit

**Update log**:

| Quarter | Date | Notes                                    |
| ------- | ---- | ---------------------------------------- |
| Q1 2026 | TBD  | First update — post-Dkron, pre-SvelteKit |

---

_Last updated: 2026-03-04_
