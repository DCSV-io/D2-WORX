# D²-WORX Internal Planning Document

> **Purpose**: Internal planning, architecture decisions, and status tracking for D²-WORX development.
> This document is for development reference and should not be considered user-facing documentation.

---

## Table of Contents

1. [Completed Summary](#completed-summary)
2. [Architecture Decisions](#architecture-decisions)
3. [Implementation Status](#implementation-status)
4. [Roadmap](#roadmap)
5. [Scheduled Jobs (Dkron)](#scheduled-jobs-dkron)
6. [Outstanding Items](#outstanding-items)

---

## Completed Summary

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
| **@d2/auth-bff-client**    | 📋 Phase 2 | `backends/node/services/auth/bff-client/`                                     | — (BFF client, HTTP — no .NET equivalent)  |
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

| Component        | Status      | Notes                           |
| ---------------- | ----------- | ------------------------------- |
| SvelteKit App    | 🚧 Scaffold | Basic setup done                |
| Auth Integration | 📋 Planned  | Proxy to Auth Service           |
| OpenTelemetry    | ✅ Done     | Client + server instrumentation |

---

## Roadmap

### Phase 2: Auth Service + SvelteKit Integration

**Stage B.5 — Scheduled Jobs (Dkron) ✅**

> Data maintenance jobs implemented across all three services. `@d2/dkron-mgr` reconciler manages 8 jobs. Full-chain E2E tested (Dkron → Gateway → Geo → PostgreSQL). See the "Scheduled Jobs (Dkron)" section below for the full job table.

10. **Job infrastructure** ✅ — HTTP endpoint pattern for Dkron callbacks, Redis `SET NX` distributed lock helper, `handleJobRpc()` / `handleRpc()` utilities, `BatchDelete` (both platforms), proto contracts (`jobs.proto`, `geo_jobs.proto`, `auth_jobs.proto`, `comms_jobs.proto`).
11. **Auth jobs** ✅ — Expired session purge (daily), sign-in event purge (daily, 90d), expired invitation cleanup (daily, 7d), expired emulation consent cleanup (daily). 4 app handlers + 4 infra purge handlers.
12. **Geo jobs** ✅ — Stale WhoIs purge (daily, 180d), orphaned location cleanup (daily). 2 app handlers + 2 infra delete handlers + `GeoJobService` gRPC service.
13. **Comms jobs** ✅ — Soft-deleted message cleanup (daily, 90d), delivery history retention (daily, 1y). 2 app handlers + 2 infra purge handlers + `CommsJobServiceServer` gRPC service.
14. **dkron-mgr** ✅ — Declarative job reconciler (drift detection, orphan cleanup, idempotent reconciliation loop). 64 tests (unit + integration + E2E).

**Dependency Update — Q1 2026**

> Bump all .NET, Node.js, and tooling dependencies to latest stable before starting SvelteKit work. This avoids pulling in a wave of client-side packages against stale foundations.

14. **Dependency audit & update** — `dotnet outdated` + `pnpm outdated`, bump all packages, run full test suites, fix any breakage. Includes .NET SDK/runtime, NuGet packages, npm packages, Aspire container image tags, and dev tooling (ESLint, Prettier, Vitest, Drizzle Kit, etc.).

**SvelteKit App Foundations**

Set up the SvelteKit app shell before wiring auth flows.

15. **Route group structure** — `(auth)/`, `(onboarding)/`, `(app)/` with org-type sub-groups (`(customer)/`, `(support)/`, `(admin)/`, etc.)
16. **Layout system** — Base layouts per org type, error/loading pages, "Viewing as [Org Name]" emulation banner
17. **Component library** — shadcn-svelte or equivalent, Tailwind v4 integration
18. **Auth proxy setup** — Proxy in `hooks.server.ts` (`/api/auth/*` → Auth Service), session population hook

**Stage C — Auth Client Libraries**

19. **@d2/auth-bff-client** — BFF client for SvelteKit: proxy helper, JWT lifecycle, `createAuthClient()`, client-side JWT manager (memory-only, auto-refresh)
20. **@d2/auth-client** — Backend gRPC client for other Node.js services (mirrors `@d2/geo-client` pattern)
21. **.NET Auth.Client** — JWT validation via JWKS + `AddJwtBearer()`, gRPC client

**Stage D — Auth Integration + Comms Con't**

22. **Sign-up flow** — SvelteKit sign-up page → Auth Service → Geo contact → verification email → onboarding
23. **Sign-in flow** — SvelteKit sign-in page → Auth Service → session → JWT for gateway
24. **Session management** — Org switching, active session list, sign-out
25. **Onboarding** — Post-verification: accept pending invitation(s) or create `customer` org
26. **.NET gateway integration** — JWT validation middleware, CORS for SvelteKit origin
27. **Comms Phase 2** — In-app notifications, push via SignalR

#### Auth Service — DDD Structure

The Auth Service follows the same DDD layering as Geo, with BetterAuth encapsulated in the infra layer:

```
backends/node/services/auth/
├── domain/            # @d2/auth-domain — Entities, value objects, domain types (the public contract)
├── app/               # @d2/auth-app — CQRS handlers, interfaces (TLC: implementations/cqrs/, interfaces/repository/, interfaces/geo/)
├── infra/             # @d2/auth-infra — BetterAuth config, repos, mappers (TLC: auth/better-auth/, repository/, mappers/)
├── api/               # @d2/auth-api — Hono entry point, routes, composition root, geo gateway impl
├── tests/             # @d2/auth-tests — Tests (unit + integration)
├── bff-client/        # @d2/auth-bff-client — BFF client for SvelteKit (HTTP, proxy, JWT manager) [planned]
├── client/            # @d2/auth-client — Backend client for other services (gRPC, like Geo.Client) [planned]
```

Mirrors .NET Geo:

```
Geo.Client / Geo.Domain / Geo.App / Geo.Infra / Geo.API / Geo.Tests
```

**Two client libraries** (auth serves two distinct consumer types):

| Client             | Package               | Consumers                    | Protocol | Purpose                                         |
| ------------------ | --------------------- | ---------------------------- | -------- | ----------------------------------------------- |
| **BFF Client**     | `@d2/auth-bff-client` | SvelteKit                    | HTTP     | Auth proxy, session management, JWT lifecycle   |
| **Backend Client** | `@d2/auth-client`     | .NET gateway, other services | gRPC     | User/org lookups, JWT validation, JWKS fetching |

- `@d2/auth-bff-client`: BFF-oriented. Proxies BetterAuth endpoints (`/api/auth/*`), manages JWT obtain/store/refresh, exposes `createAuthClient()` for SvelteKit. Works with **domain types** (tightly coupled, same codebase).
- `@d2/auth-client`: Service-oriented. gRPC stubs from `contracts/protos/auth/v1/`, handler-based (mirrors Geo.Client pattern). Works with **proto-generated types only** — no domain types exposed. Used by .NET services and future Node services that need auth data.
- **.NET side**: `Auth.Client` at `backends/dotnet/services/Auth/Auth.Client/` — gRPC client + JWT validation (`AddJwtBearer` + JWKS). Works with proto-generated C# types.

**Type boundary principle**: Domain types are internal to the auth service (and BFF). Backend consumers only see proto-generated types via gRPC. This prevents leaking domain logic between services — the proto contract IS the public API. Same pattern as Geo: `Geo.Domain` types are internal, `Geo.API` maps to proto responses, `Geo.Client` consumers only see proto types.

**Proto contracts**: `contracts/protos/auth/v1/` — auth service gRPC definitions. Mirrors `contracts/protos/geo/v1/` pattern. Needed for inter-service communication (e.g., notifications service querying user data, other services validating org membership). Service definitions will mirror how we handled Geo.

**Key design decisions:**

- **Framework-agnostic by design**: BetterAuth is an infra concern only. Domain and app layers have zero BetterAuth imports. If BetterAuth is ever swapped, only auth-infra changes.
- **Mappers in auth-app/auth-infra**: infra→domain (BetterAuth types → domain types, lives in auth-infra), domain→proto (domain types → gRPC responses, lives in auth-app). Similar to Geo's `LocationMapper`, `WhoIsMapper`, etc.
- **SignInEvent purge**: Dkron scheduled job (daily). 90-day retention. See "Scheduled Jobs (Dkron)" section.
- **Notifications service co-dependency**: Auth needs a notifications service scaffold for email verification, password reset, invitation emails. See "Notifications Service" section below.

**TLC concerns within auth-infra:**

```
auth-infra/src/
└── auth/                    # TLC concern: "Auth" (like "Repository", "Messaging")
    └── better-auth/         # Implementation (like "Pg", "MT", "Redis")
```

**Abstraction boundaries:**

- **Caching (Redis secondary storage)**: Fully abstracted. BetterAuth's `secondaryStorage` interface (`get`, `set`, `delete`) implemented by wrapping `@d2/interfaces` distributed cache handlers (IDistributedCacheGet, Set, Remove). auth-infra never imports ioredis directly.
- **Database (PostgreSQL)**: BetterAuth owns its DB connection via the Drizzle adapter (`drizzleAdapter(db, { provider: "pg", schema })`) with a dedicated `pg.Pool`. Uses `casing: "snake_case"` for PG conventions. Drizzle manages all tables (BetterAuth's 8 managed tables + 3 custom tables) with a single ORM. See ADR-009 for migration details.
- **Auth-app defines interfaces** for auth operations (sign-up, sign-in, session management, token issuance). auth-infra implements these using BetterAuth under the hood.
- **Abstraction boundary for consumers**: JWTs validated via JWKS are the inter-service boundary. Only the auth service itself depends on BetterAuth. .NET services validate JWTs statelessly via `AddJwtBearer()`.

**Dependency injection**: **`@d2/di` container** (ADR-011, implemented 2026-02-21). Replaces the earlier manual factory function approach. Each package exports an `addXxx(services, ...)` registration function (mirrors .NET `services.AddXxx()`). `ServiceCollection` + `ServiceProvider` with `Singleton`/`Scoped`/`Transient` lifetimes. `ServiceKey<T>` branded tokens for type-safe resolution. Per-request scoping via `createScopeMiddleware(provider)` (HTTP) or `createServiceScope(provider)` (gRPC/RabbitMQ).

#### Auth Domain Model (decided 2026-02-07)

**Multi-tenant, multi-org architecture.** Users are people; organizations are the tenancy unit that owns all business data. Users belong to zero or more organizations via memberships. All orgs are flat peers — no parent-child hierarchy at the auth layer.

**Organization types** (determines UI shell, capabilities, and permission scope):

| Type          | Who                                | Purpose                                          |
| ------------- | ---------------------------------- | ------------------------------------------------ |
| `admin`       | D2 site admins and engineers       | Full system access, admin control panel          |
| `support`     | D2 support team                    | Customer support, org emulation, ticket handling |
| `customer`    | Our direct customers (SMBs)        | Primary tenants — workflows, invoicing, clients  |
| `third_party` | Our customer's customers/suppliers | Limited scope — communication, shared data       |
| `affiliate`   | Referral partners                  | Referral tracking, commission dashboards         |

Org type is a required custom field on the `organization` table (via `schema.additionalFields`), validated in `beforeCreateOrganization` hook.

**When a Customer registers one of their own customers/suppliers**, a new `third_party` org is created in the system with its own members, roles, and data. The _business relationship_ between the two orgs is tracked in a domain-level table (e.g., `org_relationships` in the CRM/workflow service), NOT in the auth layer. Auth sees them as two independent orgs.

**Roles** (per-membership, hierarchical by convention):

| Role      | Permissions                                                             |
| --------- | ----------------------------------------------------------------------- |
| `auditor` | Read-only across all org data. Used for guests and emulation mode.      |
| `agent`   | Read + limited write (create/update, no delete, no org settings)        |
| `officer` | Full read/write, billing access, but cannot modify owner-level settings |
| `owner`   | Everything — org settings, member management, invitations, billing      |

Roles are defined via BetterAuth's `createAccessControl` with manual permission composition (no built-in hierarchy — spread agent perms into officer, officer into owner). Same role set applies across all org types; the org type determines which _features_ are available, not which roles exist.

**Membership model:**

- A person signs up → exists as a user with zero memberships
- Must join (via invite) or create an org to access the app
- Can belong to multiple orgs simultaneously (e.g., own a Customer org + be agent in another)
- Can switch active org at any time without re-authenticating
- Roles are per-membership (can be owner of one org and agent in another)

**Session extensions** (custom fields on BetterAuth's session table):

| Field                      | Type          | Purpose                                               |
| -------------------------- | ------------- | ----------------------------------------------------- |
| `activeOrganizationType`   | string (null) | Cached org type for the active org (avoids DB lookup) |
| `activeOrganizationRole`   | string (null) | User's role in the active org (avoids member lookup)  |
| `emulatedOrganizationId`   | string (null) | Org being viewed during support/admin emulation       |
| `emulatedOrganizationType` | string (null) | Type of the emulated org (for UI sharding)            |

BetterAuth's org plugin adds `activeOrganizationId` natively. Our 4 fields extend it.

**Org context resolution** (used by SvelteKit layouts, Hono middleware, JWT payload):

```
isEmulating = session.emulatedOrganizationId != null
effectiveOrgId   = isEmulating ? emulatedOrganizationId : activeOrganizationId
effectiveOrgType = isEmulating ? emulatedOrganizationType : activeOrganizationType
effectiveRole    = isEmulating ? "auditor" (forced read-only) : activeOrganizationRole
```

**Org emulation** (for support/admin — decided 2026-02-07):

- Only users whose `activeOrganizationType` is `support` or `admin` can emulate
- Sets `emulatedOrganizationId` + `emulatedOrganizationType` on the session
- Forces `auditor` role during emulation — **read-only, no exceptions**
- UI renders the target org's interface with a "Viewing as [Org Name]" banner
- Ending emulation nulls both fields — instant return to real org context
- All emulation actions are audit-logged (who emulated which org, when, duration)

**User impersonation** (for escalated support — BetterAuth `impersonation` plugin):

- Separate from org emulation — this is acting _as a specific user_
- Used when support needs to reproduce a user-specific issue
- **Consent model (USER-level):** A _user_ grants permission for staff to impersonate _them_ — not org-level
  - Support staff (agent+) need the target user's explicit consent to impersonate
  - Admin org members bypass consent entirely (emergency access)
  - Consent is recorded, time-limited, and revocable
- BetterAuth handles session management (creates impersonation session, "stop impersonating" returns to real session)
- More powerful and more dangerous than emulation — use sparingly

**Two-mode access model** (decided 2026-02-07):

| Mode                   | Who                     | What                    | Consent Required?  | Destructive? |
| ---------------------- | ----------------------- | ----------------------- | ------------------ | ------------ |
| **Org emulation**      | support, admin          | View another org's data | No (read-only)     | No           |
| **User impersonation** | support (agent+), admin | Act as a specific user  | Yes (user-level)\* | Yes          |

\*Admin bypasses consent requirement.

**Emulation consent table** (`emulation_consent` in auth schema):

```
emulation_consent
  id              UUID PK
  userId          FK → user (the user granting consent)
  grantedToOrgId  FK → organization (the support/admin org receiving permission)
  expiresAt       timestamp (time-limited consent)
  revokedAt       timestamp (nullable — null = active)
  createdAt       timestamp
```

- Consent is per-user, per-org (e.g., user X grants org "Support Team" impersonation rights)
- Admin org bypasses this table entirely — they have implicit consent
- Revoking consent immediately blocks future impersonation (but doesn't kill active sessions — see BetterAuth's `impersonation` plugin for session lifecycle)

**Contact architecture** (decided 2026-02-07):

Auth stores **no contact data** (names, phones, addresses, etc.). Contact info lives in the Geo service's `Contact` entity, which is a shared cross-service resource.

- **For users:** Geo's `Contact` references the user directly (`relatedEntityId = userId`). No auth-side table needed.
- **For orgs:** Auth has a thin `org_contact` junction table that provides the address-book structure (labels, primary flag). Geo's `Contact` records reference `org_contact.id` for the foreign key relationship.

```
org_contact (auth schema)
  id          UUID PK
  orgId       FK → organization
  label       string ("primary", "billing", "shipping", "warehouse", etc.)
  isPrimary   boolean (at most one per org)
  createdAt   timestamp
  updatedAt   timestamp
```

Geo's Contact then stores the actual address/phone/email data:

```
contact (geo schema, existing entity)
  hashId              content-addressable PK
  relatedEntityId     string (userId for personal, org_contact.id for org addresses)
  relatedEntityType   string ("user" | "org_contact")
  ...address fields, phone, email, etc.
```

This keeps auth thin (identity + org structure only) while letting Geo own all geographic/contact data. Deleting an org_contact row cascades logically to its Geo Contact records.

**Sign-in audit** (decided 2026-02-07):

Flat event log for authentication attempts. Not a session table — captures individual sign-in attempts for security auditing.

```
sign_in_event (auth schema)
  id          UUID PK
  userId      FK → user (nullable — null for failed attempts with unknown user)
  successful  boolean
  ipAddress   string (encrypted at rest — PII)
  userAgent   string
  whoIsId     string (nullable — FK to Geo's WhoIs for location context at time of sign-in)
  createdAt   timestamp
```

- Leverages existing `FindWhoIs` handler from `@d2/geo-client` to resolve IP → location at sign-in time
- `whoIsId` is content-addressable (same IP+month+fingerprint = same hash), so location data is deduplicated
- Failed attempts with a valid email but wrong password still log with the userId
- Truly unknown attempts (invalid email) log with `userId = null`
- Used for: suspicious login detection, account lockout decisions, compliance audit trails

#### Auth Domain Aggregates & Entities (decided 2026-02-07)

Data that leaves the auth service (except raw BetterAuth proxy to SvelteKit) is always represented as domain types, never BetterAuth internal types. BetterAuth is an infra detail — the domain model is the public contract.

**Database conventions:**

- `OrgType` and `Role` are stored as **plain text** in PG (NOT PG enums — avoids migration pain)
- TypeScript types use string unions for compile-time safety
- All tables in the `auth` PG schema (`search_path=auth`)

##### User Aggregate (root: `User`)

The User aggregate owns all identity-related data. BetterAuth manages the core `user` and `account` tables; our domain layer defines the canonical types and auth-infra maps between them.

```
User (BetterAuth-managed table: user)
  id                string       PK
  email             string       unique
  name              string
  emailVerified     boolean
  image             string?
  createdAt         Date
  updatedAt         Date
  ├── accounts            Account[]            1:N  (linked auth providers)
  ├── sessions            Session[]            1:N  (active sessions)
  ├── memberships         Member[]             1:N  (orgs this user belongs to — read navigation)
  ├── invitations         Invitation[]         1:N  (pending invites for this user's email — read navigation)
  ├── signInEvents        SignInEvent[]         1:N  (auth attempt audit log)
  └── emulationConsents   EmulationConsent[]   1:N  (impersonation grants given by this user)
```

**Child entities:**

```
Account (BetterAuth-managed table: account)
  id                      string    PK
  userId                  string    FK → User (cascade delete)
  providerId              string    "credential" | "google" | "github" | etc.
  accountId               string    provider-specific user identifier
  accessToken             string?   OAuth access token
  refreshToken            string?   OAuth refresh token
  idToken                 string?   OAuth ID token
  accessTokenExpiresAt    Date?
  refreshTokenExpiresAt   Date?
  scope                   string?   OAuth scopes granted
  password                string?   hashed (credential provider only)
  createdAt               Date
  updatedAt               Date

Session (BetterAuth-managed table: session)
  id                          string    PK
  userId                      string    FK → User (cascade delete)
  token                       string    opaque session token
  ipAddress                   string?
  userAgent                   string?
  expiresAt                   Date
  createdAt                   Date
  updatedAt                   Date
  activeOrganizationId        string?   (BetterAuth org plugin — native)
  activeOrganizationType      string?   (custom extension)
  activeOrganizationRole      string?   (custom extension)
  emulatedOrganizationId      string?   (custom extension)
  emulatedOrganizationType    string?   (custom extension)

SignInEvent (custom table: sign_in_event)
  id          string    PK (UUID v7)
  userId      string?   FK → User (nullable — null for unknown-user attempts)
  successful  boolean
  ipAddress   string    (encrypted at rest — PII)
  userAgent   string
  whoIsId     string?   (nullable — references Geo WhoIs for location context)
  createdAt   Date

EmulationConsent (custom table: emulation_consent)
  id              string    PK (UUID v7)
  userId          string    FK → User (the user granting consent)
  grantedToOrgId  string    FK → Organization (the support/admin org)
  expiresAt       Date      (time-limited)
  revokedAt       Date?     (nullable — null = active)
  createdAt       Date
```

##### Organization Aggregate (root: `Organization`)

The Organization aggregate owns org structure — members, invitations, and address book entries. Organization is the write owner for Member and Invitation; User has read-only navigation to the same entities.

```
Organization (BetterAuth-managed table: organization)
  id          string    PK
  name        string
  slug        string    unique
  type        OrgType   (custom field via schema.additionalFields — text in DB)
  logo        string?
  metadata    string?
  createdAt   Date
  ├── members      Member[]      1:N  (people in this org — write owner)
  ├── invitations  Invitation[]  1:N  (invites sent by this org — write owner)
  └── contacts     OrgContact[]  1:N  (address book entries → Geo Contact)
```

**Child entities:**

```
Member (BetterAuth-managed table: member)
  id              string    PK
  userId          string    FK → User
  organizationId  string    FK → Organization (cascade delete)
  role            Role      text in DB
  createdAt       Date

Invitation (BetterAuth-managed table: invitation)
  id              string    PK
  email           string    (target user's email)
  organizationId  string    FK → Organization (cascade delete)
  role            Role      text in DB (role to assign on acceptance)
  inviterId       string    FK → User (who sent the invite)
  status          string    "pending" | "accepted" | "rejected" | "expired"
  expiresAt       Date
  createdAt       Date

OrgContact (custom table: org_contact)
  id          string    PK (UUID v7)
  orgId       string    FK → Organization (cascade delete)
  label       string    "primary" | "billing" | "shipping" | "warehouse" | etc.
  isPrimary   boolean   (at most one per org)
  createdAt   Date
  updatedAt   Date
```

##### Value Objects

```
OrgType = "admin" | "support" | "customer" | "third_party" | "affiliate"
  Stored as text in DB. Determines UI shell, capabilities, permission scope.

Role = "auditor" | "agent" | "officer" | "owner"
  Stored as text in DB. Per-membership, composed via createAccessControl.

SessionContext (computed, not persisted)
  effectiveOrgId      string?     resolved from session (emulated or active)
  effectiveOrgType    OrgType?    resolved from session
  effectiveRole       Role?       forced to "auditor" during emulation
  isEmulating         boolean     true if emulatedOrganizationId is set
```

##### Bidirectional Relationships

`Member` and `Invitation` appear in both aggregates. The **Organization aggregate** is the write owner (add/remove/update operations go through the org). The **User aggregate** has read-only navigation for "which orgs am I in?" and "what invitations do I have?".

| Entity       | Write Owner  | Read Navigation | Join Key                                  |
| ------------ | ------------ | --------------- | ----------------------------------------- |
| `Member`     | Organization | User            | `member.userId` ↔ `member.organizationId` |
| `Invitation` | Organization | User            | `invitation.email` ↔ `user.email`         |

##### BetterAuth-Managed vs Custom Tables

| Table               | Managed By   | Notes                                                 |
| ------------------- | ------------ | ----------------------------------------------------- |
| `user`              | BetterAuth   | Core; we add no custom fields                         |
| `account`           | BetterAuth   | Core; 1:N per user (multi-provider)                   |
| `session`           | BetterAuth   | Core + org plugin + 4 custom extension fields         |
| `verification`      | BetterAuth   | Email verification tokens (infra only, not in domain) |
| `jwks`              | BetterAuth   | JWT key pairs (infra only, not in domain)             |
| `organization`      | BetterAuth   | Org plugin + custom `type` field                      |
| `member`            | BetterAuth   | Org plugin; role stored as text                       |
| `invitation`        | BetterAuth   | Org plugin                                            |
| `org_contact`       | Us (Drizzle) | Custom — address book junction → Geo Contact          |
| `sign_in_event`     | Us (Drizzle) | Custom — auth attempt audit log                       |
| `emulation_consent` | Us (Drizzle) | Custom — user-level impersonation consent             |

`verification` and `jwks` are pure BetterAuth infrastructure — they never leave auth-infra and are not represented in the domain model.

##### Business Rules (decided 2026-02-07)

**Org creation authorization:**

| Org Type      | Who Can Create                | How                                             |
| ------------- | ----------------------------- | ----------------------------------------------- |
| `customer`    | Any user (self-service)       | Directly during onboarding or later via UI      |
| `third_party` | `customer` users (indirectly) | Via product workflow (registering their client) |
| `support`     | `admin` only                  | Admin control panel                             |
| `admin`       | `admin` only                  | Admin control panel                             |
| `affiliate`   | `admin` only                  | Admin control panel                             |

Only `customer` orgs can be created with "a couple clicks." `third_party` orgs are created as a side effect of customer workflows, not directly by the user.

**Onboarding flow:**

1. User signs up (email/password or Google/LinkedIn)
2. Email verification required
3. Post-verification screen: accept pending invitation(s) OR create a `customer` org
4. No app access until at least one org membership exists
5. SvelteKit redirects unauthenticated users to `(auth)/`, no-org users to `(onboarding)/`

**Member removal cascading:**

- When a user is removed from an org, all their sessions with that org as `activeOrganizationId` are **immediately terminated**
- SignalR gateway signs them out in real-time (WebSocket disconnect)
- If removed from their only org, user returns to onboarding state (join/create)
- **Last-owner protection**: The last `owner` is blocked from leaving or downgrading. Two options presented:
  1. **Transfer ownership** — select another member → email confirmation → ownership transferred → original owner can then leave
  2. **Delete the org** — email confirmation required → org and all associated data deleted

**Account linking constraints:**

- One account per provider per user (no duplicate Google accounts, etc.)
- BetterAuth's `accountLinking.trustedProviders` controls which OAuth providers auto-link on matching email

**Sign-in event retention:**

- 90 days (matches WhoIs retention pattern)
- Purge via scheduled job or Drizzle query

**Invitation lifecycle:**

- Invitations expire after **7 days**
- Org owners can revoke pending invitations
- Users can **accept** or **reject** invitations
- Expired invitations are cleaned up (scheduled job or on-read purge)

**No-org state:**

- Freshly signed-up users have no `activeOrganizationId`
- SvelteKit redirects to onboarding flow: accept pending invites or create an org
- No access to any app features until at least one org membership exists

**JWT payload** (includes org context for .NET gateway and services):

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "name": "Display Name",
  "activeOrganizationId": "org-123",
  "activeOrganizationType": "customer",
  "activeOrganizationRole": "officer",
  "emulatedOrganizationId": null,
  "isEmulating": false,
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Important**: When a user switches orgs or starts/stops emulation, the client must request a new JWT. The old JWT remains valid until its 15-minute expiry but carries stale org context. `@d2/auth-bff-client` handles this: `setActiveOrg()` → `refreshJwt()` atomically.

**BetterAuth organization plugin — gap analysis (75% fit):**

| Requirement                     | OOTB? | Gap                                    | Effort |
| ------------------------------- | ----- | -------------------------------------- | ------ |
| Users belong to 0+ orgs         | Yes   | None                                   | —      |
| Sign up, join/create orgs later | Yes   | None                                   | —      |
| 5 organization types            | No    | Add custom field + validation hook     | Low    |
| Custom roles (4 levels)         | Yes   | No hierarchy syntax, compose manually  | Low    |
| Org-specific session switching  | Yes   | Known bugs (#4708, #3233)              | Low    |
| Org type in session             | No    | Custom session fields                  | Low    |
| Org emulation                   | No    | Custom session fields + middleware     | Medium |
| User impersonation              | Yes   | Built-in `impersonation` plugin        | —      |
| Org context in JWT              | No    | `definePayload` needs session lookup   | Medium |
| Invitation per org type         | No    | Branch logic in hooks                  | Low    |
| Admin cross-org visibility      | No    | Query DB directly                      | Medium |
| Member list privacy per role    | No    | Security issue #6038, need hook filter | Medium |

#### Auth Service — Configuration

- **Framework**: Hono + BetterAuth v1.4.x (pin exact version)
- **Database adapter**: Drizzle adapter (`drizzleAdapter(db, { provider: "pg", schema })`) — see ADR-009
  - Single ORM (Drizzle) for all tables: BetterAuth's 8 managed tables + 3 custom tables
  - `casing: "snake_case"` — matches our PG conventions
  - Drizzle Kit for migrations (`drizzle-kit generate` + `drizzle-kit migrate`)
  - BetterAuth manages its own connection pool; auth-api provides the `Pool` at startup
- **Secondary storage**: `SecondaryStorage` interface wrapping `@d2/interfaces` distributed cache handlers
  - Interface is minimal: `get(key): string | null`, `set(key, value, ttl?)`, `delete(key)`
  - TTL is in **seconds** (not milliseconds)
- **Plugins**:
  - `bearer()` — session token via Authorization header
  - `jwt({ jwks: { keyPairConfig: { alg: "RS256", modulusLength: 2048 } } })` — RS256 JWTs for .NET services
  - `organization({ ... })` — multi-org membership, roles, invitations, `activeOrganizationId` on session
  - `access` — RBAC with `createAccessControl` for custom role-permission definitions
  - `impersonation()` — user-level impersonation for escalated support (audit-logged)
  - **Important**: Config value is `"RS256"` (standard JOSE name). BetterAuth docs may show `"RSA256"` (typo). The alg is passed directly to jose's `generateKeyPair()` which requires `"RS256"`.
- **JWT**: `expirationTime: "15m"`, custom `definePayload` for D2 claims (sub, email, name, org context, role). Must include `activeOrganizationId`, `activeOrganizationType`, `activeOrganizationRole`, `emulatedOrganizationId`, and `isEmulating`. Client must re-fetch JWT after org switch or emulation start/stop.
- **Cookie cache**: `{ enabled: true, maxAge: 300, strategy: "compact" }` (5min, base64url + HMAC-SHA256)
- **Session**: `expiresIn: 7 days`, `updateAge: 1 day`, `storeSessionInDatabase: true` (dual-write Redis + PG)
- **Key rotation**: `rotationInterval: 30 days`, `gracePeriod: 30 days`
- **Session management**: list, revoke individual, revoke others, revoke all (OOTB from BetterAuth)
- **Hono integration**: Route-based mount `app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))`
- **CORS**: Must be registered BEFORE BetterAuth routes; allow SvelteKit origin with credentials

#### Auth Service — Known Gotchas (from research 2026-02-07)

**HIGH — Session + Secondary Storage bugs (monitor these issues):**

| Issue                                                           | Description                                                                    | Mitigation                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [#6987](https://github.com/better-auth/better-auth/issues/6987) | `updateSession` doesn't sync back to Redis (stale data)                        | Monitor; may need to manually invalidate Redis on profile update      |
| [#6993](https://github.com/better-auth/better-auth/issues/6993) | Session in Redis missing `id` field with `storeSessionInDatabase: true`        | Test early; may be fixed in newer versions                            |
| [#5144](https://github.com/better-auth/better-auth/issues/5144) | `revokeSession` removes from Redis but not PG with `preserveSessionInDatabase` | Don't use `preserveSessionInDatabase` initially; test revocation flow |
| [#4203](https://github.com/better-auth/better-auth/issues/4203) | Redis TTL expiry doesn't fall back to DB (premature invalidation)              | Set Redis TTL >= session `expiresIn` to avoid premature expiry        |
| [#3819](https://github.com/better-auth/better-auth/issues/3819) | `active-sessions` list not cleaned on sign-out                                 | Test `listSessions()` after sign-out; may need workaround             |

**MODERATE — Schema/casing:**

| Issue                                                           | Description                                                  | Mitigation                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| [#5649](https://github.com/better-auth/better-auth/issues/5649) | SSO/OIDC plugins bypass `casing: "snake_case"` field mapping | We don't use SSO/OIDC initially; test if added later          |
| [#3774](https://github.com/better-auth/better-auth/issues/3774) | `modelName` hardcoded in some internal paths                 | Test custom table names with our plugin combination           |
| [#3954](https://github.com/better-auth/better-auth/issues/3954) | JWKS table queried on every `getSession()` (not cached)      | Performance concern; monitor and potentially cache externally |

**MODERATE — Organization plugin:**

| Issue                                                           | Description                                                   | Mitigation                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| [#4708](https://github.com/better-auth/better-auth/issues/4708) | `set-active` endpoint sometimes has null session context      | Use `getSessionFromCtx` workaround                 |
| [#6038](https://github.com/better-auth/better-auth/issues/6038) | `/get-full-organization` exposes member list to all roles     | Hook-based filter or endpoint wrapper              |
| [#6081](https://github.com/better-auth/better-auth/issues/6081) | `hasPermission` silently returns false for unknown roles      | Fix in progress (PR #6097); add defensive logging  |
| [#2100](https://github.com/better-auth/better-auth/issues/2100) | `updateMemberRole` fails on members with existing multi-roles | Avoid multi-role per member initially; monitor fix |

**LOW — Design considerations:**

- `customSession` plugin data is NOT cached in Redis or cookie cache (function runs every `getSession()`)
- BetterAuth's built-in rate limiter is per-path only — we use our own `@d2/ratelimit` instead
- Cookie cache invalidation is version-based (`cookieCache.version`), not per-user
- No built-in role hierarchy — must compose permissions manually (spread pattern)
- `definePayload` receives user, not session — need session lookup for org context in JWT

#### SvelteKit Auth Integration

- Auth proxy in `hooks.server.ts` (`/api/auth/*` → Auth Service)
- Session population hook (forward cookie to Auth Service for validation, or decode cookie cache locally)
- `createAuthClient` setup (no `baseURL` needed — same-origin proxy)
- Client-side JWT manager (part of `@d2/auth-bff-client` — obtain, store in memory, auto-refresh)
- CORS configuration for direct gateway access (Pattern C, ADR-005)

**UI sharding by org type** (decided 2026-02-07):

SvelteKit routes are grouped by org type. The `(app)/+layout.server.ts` resolves org context from the session and renders the appropriate layout group:

```
clients/web/src/routes/
├── (auth)/                    # Unauthenticated (login, signup)
├── (onboarding)/              # Authenticated, no active org (join/create)
├── (app)/                     # Authenticated, org-scoped
│   ├── +layout.server.ts      # Resolves orgType → renders correct layout
│   ├── (customer)/            # Customer org: workflows, invoicing, clients
│   ├── (third-party)/         # Third-party org: communication, limited data
│   ├── (affiliate)/           # Affiliate: referral tracking, commissions
│   ├── (support)/             # Support: tickets, customer lookup, org emulation
│   └── (admin)/               # Admin: system control panel, user/org management
```

- Layout server load reads `effectiveOrgType` from session (resolved via `resolveOrgContext()`)
- Redirects to `(onboarding)` if no active org
- Returns 403 if accessing a route for a different org type
- During emulation: renders the target org's UI with "Viewing as [Org Name]" banner

#### .NET Gateway JWT Validation

- `Auth.Client` at `backends/dotnet/services/Auth/Auth.Client/`
- `AddJwtBearer()` with JWKS from Auth Service
- RS256 validation (native `Microsoft.IdentityModel.Tokens`)
- CORS middleware for SvelteKit origin
- JWKS caching with periodic refresh

### Phase 3: Auth Features (Future)

1. **Session management UI** (list sessions, revoke individual, revoke all others)
2. **Org emulation** (support/admin can view any org's data in read-only mode)
3. **User impersonation** (escalated support — act as a specific user, audit-logged, time-limited)
4. **Admin control panel** (cross-org visibility, user/org management, system diagnostics)
5. **Admin alerting** (rate limit threshold alerts via Comms service)
6. **Comms expansion** — In-app notifications, push via SignalR, conversational messaging (Comms Phases 2-4)

---

## Scheduled Jobs (Dkron)

**Infrastructure**: Dkron v4.0.9 runs as a persistent Aspire container (dashboard: `:8888`, `--node-name=dkron`). `@d2/dkron-mgr` reconciles job definitions against Dkron REST API. Jobs call REST Gateway HTTP endpoints with service key auth, Gateway forwards via gRPC with API key auth. Handlers acquire Redis `SET NX PX` distributed locks before executing batch deletes.

| Job                                 | Owner | Schedule      | Retention | Status | Notes                                                                                           |
| ----------------------------------- | ----- | ------------- | --------- | ------ | ----------------------------------------------------------------------------------------------- |
| **Purge expired sessions (PG)**     | Auth  | Daily 02:30   | 0 days    | ✅     | `auth-purge-sessions` — DELETE `session` WHERE `expires_at < NOW()`                             |
| **Purge sign-in events**            | Auth  | Daily 02:45   | 90 days   | ✅     | `auth-purge-sign-in-events` — batch delete via `batchDelete()`                                  |
| **Cleanup expired invitations**     | Auth  | Daily 03:00   | 7 days    | ✅     | `auth-cleanup-invitations` — DELETE expired invitations past retention grace period              |
| **Cleanup emulation consents**      | Auth  | Daily 03:15   | 0 days    | ✅     | `auth-cleanup-emulation-consents` — DELETE WHERE expired OR revoked                             |
| **Purge stale WhoIs**               | Geo   | Daily 02:00   | 180 days  | ✅     | `geo-purge-stale-whois` — BatchDelete by cutoff year/month. Runs BEFORE location cleanup        |
| **Cleanup orphaned locations**      | Geo   | Daily 02:15   | N/A       | ✅     | `geo-cleanup-orphaned-locations` — DELETE locations with zero contact + zero WhoIs references    |
| **Purge soft-deleted messages**     | Comms | Daily 03:30   | 90 days   | ✅     | `comms-purge-deleted-messages` — batch delete messages past retention                           |
| **Purge delivery history**          | Comms | Daily 03:45   | 365 days  | ✅     | `comms-purge-delivery-history` — batch delete old delivery_request + delivery_attempt rows      |

**Already handled (no Dkron job needed):**

- Idempotency keys: Redis TTL (24h)
- Rate limit counters/blocks: Redis TTL
- Redis cache entries: Redis TTL + LRU eviction
- In-memory cache: Lazy TTL + LRU eviction
- Comms delivery retries: RabbitMQ DLX + tier queue TTLs
- JWKS key rotation: BetterAuth-managed
- BetterAuth verification tokens: Lazy bulk-delete on any `findVerificationValue` call (since v1.2.0)

---

## Dependency Update Policy

**Cadence**: Quarterly (March, June, September, December). Bump everything to latest stable.

**Scope**:

- .NET SDK/runtime, NuGet packages (`dotnet outdated`)
- Node.js/pnpm packages (`pnpm outdated`, all `@d2/*` + third-party)
- Aspire container image tags (PostgreSQL, Redis, RabbitMQ, Dkron, LGTM stack)
- Dev tooling (ESLint, Prettier, Vitest, TypeScript, Drizzle Kit, Buf)
- BetterAuth (pin exact, test thoroughly — check known gotchas list for regressions)

**Process**:

1. Run `dotnet outdated` and `pnpm outdated` to identify stale packages
2. Bump in dependency order (shared packages first, then services, then clients)
3. Run full test suites after each tier (.NET: `dotnet test`, Node: `pnpm vitest`)
4. Fix any breakage before proceeding to next tier
5. Update Aspire container image tags, verify orchestration starts cleanly
6. Commit as a single `chore: quarterly dependency update (Q# YYYY)` PR

**Timing rule**: Always do the quarterly bump **before** starting a new major feature phase — especially before pulling in new client-side dependencies (e.g., SvelteKit libraries). This keeps the foundation current and avoids version conflicts with freshly installed packages.

**Update log**:

| Quarter | Date | Notes                                    |
| ------- | ---- | ---------------------------------------- |
| Q1 2026 | TBD  | First update — post-Dkron, pre-SvelteKit |

---

## Outstanding Items

### Open — Can Fix Now

| #   | Item                                                | Owner  | Effort | Notes                                                                                                              |
| --- | --------------------------------------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| 32  | Thundering herd protection on popular key expiry    | Shared | Medium | Add singleflight/lock pattern for cache-memory on popular key expiry                                               |
| 39  | Circuit breaker for non-critical cross-service gRPC | All    | Medium | Add circuit breaker pattern (e.g., `opossum`) around geo-client gRPC calls — fast-fail under sustained Geo failure |
| 40  | OTel alerting for service outages                   | All    | Medium | Add OTel-based alerting rules for service unavailability (gRPC failures, RabbitMQ down, Redis down)                |

### Open Questions

- **Emulation/impersonation implementation details**: Authorization model decided (org emulation = read-only no consent, user impersonation = user-level consent, admin bypass). Remaining: should impersonation require 2FA? Should there be a max impersonation duration? How does `emulation_consent` integrate with BetterAuth's `impersonation` plugin hooks?

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

_Last updated: 2026-02-27_
