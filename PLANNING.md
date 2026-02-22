# D²-WORX Internal Planning Document

> **Purpose**: Internal planning, architecture decisions, and status tracking for D²-WORX development.
> This document is for development reference and should not be considered user-facing documentation.

---

## Table of Contents

1. [Current Sprint Focus](#current-sprint-focus)
2. [Architecture Decisions](#architecture-decisions)
3. [Implementation Status](#implementation-status)
4. [Upcoming Work](#upcoming-work)
5. [Technical Debt](#technical-debt)
6. [Open Questions](#open-questions)

---

## Current Sprint Focus

### Primary Goals

1. **Phase 1: TypeScript Shared Infrastructure** - Build shared `@d2/*` packages mirroring .NET (complete ✅)
2. **Phase 2: Auth Service Implementation** - Standalone Node.js + Hono + BetterAuth at `backends/node/services/auth/`
3. **Phase 2: SvelteKit Auth Integration** - Proxy pattern (`/api/auth/*` → Auth Service)

### Recently Completed

- ✅ pnpm workspace setup (root at `D2-WORX/`, shared packages + services + web client)
- ✅ Shared `tsconfig.base.json` at `backends/node/`
- ✅ Vitest root config with projects discovery + shared config
- ✅ `@d2/result` — D2Result pattern (mirrors `D2.Shared.Result`)
- ✅ `@d2/utilities` — Array/UUID/string helpers, cache constants (mirrors `D2.Shared.Utilities`)
- ✅ `@d2/protos` — Generated TS proto types + gRPC client stubs (Buf + ts-proto)
- ✅ `@d2/testing` — Custom Vitest matchers for D2Result assertions
- ✅ `@d2/shared-tests` — initial 161 tests covering foundation packages
- ✅ ESLint 9 + Prettier monorepo configuration (root-level, covers all packages + web client)
- ✅ `@d2/logging` — ILogger interface with Pino implementation (auto-instrumented via OTel)
- ✅ `@d2/service-defaults` — One-call OTel SDK bootstrap (`setupTelemetry()`), re-exports OTel API
- ✅ `@d2/handler` — BaseHandler with OTel spans + metrics, mirrors .NET handler pattern
- ✅ .NET BaseHandler metrics (duration histogram, invocations/failures/exceptions counters)
- ✅ `@d2/shared-tests` — 186 tests (25 new for logging + handler)
- ✅ `@d2/interfaces` — Cache operation contracts (in-memory: 5 handlers, distributed: 6 handlers)
- ✅ `@d2/result-extensions` — D2Result ↔ Proto conversions + gRPC call wrapper
- ✅ `@d2/shared-tests` — 240 tests (54 new for interfaces + result-extensions)
- ✅ `@d2/cache-memory` — In-memory cache store + 5 handlers (Get, GetMany, Set, SetMany, Remove)
- ✅ `@d2/cache-redis` — Redis cache via ioredis + 6 handlers (Get, Set, Remove, Exists, GetTtl, Increment)
- ✅ `@d2/shared-tests` — 290 tests (50 new: 29 unit for cache-memory, 21 integration for cache-redis)
- ✅ `MemoryCacheStore` LRU — Always-on LRU eviction with default maxEntries=10,000
- ✅ `@d2/messaging` — Thin RabbitMQ wrapper (rabbitmq-client), MessageBus with subscribe + publish
- ✅ `@d2/geo-client` — Full Geo.Client parity: 9 CQRS handlers, messaging handler, consumer bridge
- ✅ `@d2/shared-tests` — 375 tests (85 new: LRU, messaging, geo-client handlers)
- ✅ Node.js TLC folder restructuring — interfaces, cache handlers, geo-client interfaces, implementation dirs
- ✅ Node.js `RedactionSpec` type + `BaseHandler` integration in `@d2/handler`
- ✅ Node.js redaction specs on handler interfaces + wired to handler implementations
- ✅ .NET `RedactDataDestructuringPolicy` — Serilog destructuring policy for `[RedactData]` attribute
- ✅ .NET `DefaultOptions` virtual property on `BaseHandler` for handler-level logging defaults
- ✅ .NET handler I/O annotations + `DefaultOptions` overrides (Geo.Client, RateLimit)
- ✅ `@d2/shared-tests` — 445 tests (70 new: redaction infrastructure coverage)
- ✅ .NET tests — 289 passing (11 new: DefaultOptionsTests + RedactDataDestructuringPolicyTests)
- ✅ Step 7c: Input Validation Infrastructure — Zod + `validateInput` on Node.js BaseHandler, FluentValidation extensions on .NET, aggregate validators (Contact, WhoIs, Location), wired to all 6 Geo handlers + 2 Node.js handlers, 40+ new .NET tests, 507 Node.js tests
- ✅ Phase 2 Stage B: Auth service DDD layers (domain, app, infra, api) — 4 packages, 437 tests
- ✅ Auth TLC folder alignment — app + infra restructured to match Geo.App/Geo.Infra conventions
- ✅ Auth org contact rework — full Geo integration (create/delete/update/get via `@d2/geo-client` handlers), contact immutability
- ✅ Auth sign-in event caching — local memory cache with staleness check (latest event date)
- ✅ `@d2/idempotency` — Idempotency-Key header middleware (ADR-007)
- ✅ `@d2/utilities` — UUIDv7 generation added
- ✅ .NET Gateway JWT auth — JwtAuthExtensions, JwtFingerprintMiddleware, AuthPolicies, RoleValues, OrgTypeValues, RequestContext JWT extraction
- ✅ Ext-key-only contact API — Contacts accessed externally via contextKey+relatedEntityId (ID-based get/delete removed from client libs), API key authentication (gRPC metadata), allowedContextKeys defense-in-depth
- ✅ Geo.Client ext-key handlers — GetContactsByExtKeys, DeleteContactsByExtKeys, UpdateContactsByExtKeys (both .NET and Node.js)
- ✅ @d2/shared-tests — 663 tests (up from 507)
- ✅ .NET shared tests — 565 passing (gateway auth, idempotency, retry, allowedContextKeys)
- ✅ .NET Geo tests — 722 passing (contacts ext-key integration tests)
- ✅ Context key validation refactored to built-in validateInput (Zod + FluentValidation)
- ✅ Comms service — Phase 1 DDD layers: domain (entities, enums, rules), app (delivery handlers, sub-handlers), infra (Drizzle schema, Resend email, Twilio SMS, RabbitMQ consumer, template seeding)
- ✅ Comms API — gRPC server (`@d2/comms-api`): composition root, proto ↔ domain mappers, Phase 1 handlers wired, Phase 2-3 stubs UNIMPLEMENTED
- ✅ Comms proto contract — `contracts/protos/comms/v1/comms.proto` (full Phase 1-3 surface)
- ✅ Auth entrypoint — `main.ts` with Hono HTTP server, optional RabbitMQ publisher
- ✅ Aspire wiring — Auth + Comms services via `AddJavaScriptApp` + `.WithPnpm()` (databases, Redis, RabbitMQ refs)
- ✅ CI — Comms unit + integration test jobs in GitHub Actions
- ✅ Comms tests — 550 unit tests passing (44 test files)
- ✅ Auth tests — 617 tests passing (52 test files, up from 437)
- ✅ Shared tests — 636 tests passing (45 test files)
- ✅ `@d2/di` — Lightweight DI container: ServiceKey, ServiceCollection, ServiceProvider, ServiceScope (ADR-011)
- ✅ DI refactoring — Auth + Comms composition roots refactored to use ServiceCollection with per-request/per-RPC/per-message scoping
- ✅ Registration functions — `addAuthInfra()`, `addAuthApp()`, `addCommsInfra()`, `addCommsApp()` mirror .NET `services.AddXxx()`
- ✅ BaseHandler traceId auto-injection — eliminates 174 occurrences of `traceId: this.traceId` boilerplate
- ✅ Shared tests — 671 tests passing (35 new DI tests: ServiceCollection, ServiceProvider, ServiceScope, traceId auto-injection)
- ✅ Invitation email delivery — Custom `/api/invitations` route, `PublishInvitationEmail` handler, proto fields (`invitee_user_id`, `invitee_contact_id`), `GetContactsByIds` handler in geo-client, RecipientResolver dual-path (userId via ext-keys, contactId via direct ID lookup), `HandleInvitationEmail` fix (was passing email string as contactId)
- ✅ E2E tests — 5 cross-service tests (verification email × 2, password reset, invitation for new user, invitation for existing user) via Testcontainers (PG × 3 + Redis + RabbitMQ) + .NET Geo child process
- ✅ Defensive programming test sweep — 70 new security/edge-case tests across auth middleware, CSRF, session, scope, invitation route, emulation rules, comms handlers
- ✅ Auth tests — 832 passing (63 test files), Comms tests — 658 passing (54 test files), Shared tests — 726 passing (59 test files)
- ✅ Open question validation tests — 28 integration tests resolving Q1 (RS256 JWT), Q2 (session lifecycle), Q3 (additionalFields), Q4 (definePayload), Q6 (snake_case), Q7 (pre-generated IDs). Key finding: setActiveOrganization does NOT auto-populate custom session fields — app-layer hook needed
- ✅ Auth tests — 860 passing (64 test files)

### Blocked By

- None currently

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
- `addCommsApp(services)` — delivery handlers + sub-handlers

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

| Component     | Status     | Notes                  |
| ------------- | ---------- | ---------------------- |
| PostgreSQL 18 | ✅ Done    | Aspire-managed         |
| Redis 8.2     | ✅ Done    | Aspire-managed         |
| RabbitMQ 4.1  | ✅ Done    | Aspire-managed         |
| MinIO         | ✅ Done    | Aspire-managed         |
| LGTM Stack    | ✅ Done    | Full observability     |
| ~~Keycloak~~  | ❌ Removed | Replaced by BetterAuth |

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
| **@d2/auth-client**        | 📋 Phase 2 | `backends/node/services/auth/auth-client/`                                    | — (BFF client, HTTP — no .NET equivalent)  |
| **@d2/auth-sdk**           | 📋 Phase 2 | `backends/node/services/auth/auth-sdk/`                                       | `Auth.Client` (gRPC, service-to-service)   |

### Services

| Service          | Status         | Notes                                                                                                           |
| ---------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| Geo.Domain       | ✅ Done        | Entities, value objects                                                                                         |
| Geo.App          | ✅ Done        | CQRS handlers, mappers                                                                                          |
| Geo.Infra        | ✅ Done        | Repository, messaging                                                                                           |
| Geo.API          | ✅ Done        | gRPC service                                                                                                    |
| Geo.Client       | ✅ Done        | Service-owned client library (messages, interfaces, handlers)                                                   |
| Geo.Tests        | ✅ Done        | 708 tests passing                                                                                               |
| **Auth Service** | 🚧 In Progress | Node.js + Hono + BetterAuth (`backends/node/services/auth/`). Stage B done + invitation email delivery + E2E    |
| **Auth.Tests**   | 🚧 In Progress | Auth service tests (`backends/node/services/auth/tests/`) — 860 tests passing                                   |
| **Comms.Domain** | ✅ Done        | Entities, enums, rules, constants (`backends/node/services/comms/domain/`)                                      |
| **Comms.App**    | ✅ Done        | CQRS handlers, delivery orchestrator, sub-handlers (`backends/node/services/comms/app/`)                        |
| **Comms.Infra**  | ✅ Done        | Drizzle schema/migrations, Resend + Twilio providers, RabbitMQ consumer (`backends/node/services/comms/infra/`) |
| **Comms.API**    | ✅ Done        | gRPC server + composition root + mappers (`backends/node/services/comms/api/`)                                  |
| **Comms.Tests**  | ✅ Done        | 658 tests passing (`backends/node/services/comms/tests/`)                                                       |

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

## Upcoming Work

### Phase 1: TypeScript Shared Infrastructure (Complete ✅)

> **Note:** Before building the Auth Service, we need shared TypeScript packages that mirror what already exists on the .NET side. This is the "rebuild in TypeScript" step. Package structure mirrors .NET's TLC folder convention.

**Step 1 — Workspace + Foundation (Layer 0)** ✅

1. ✅ **pnpm workspace setup** — root at `D2-WORX/`, `pnpm-workspace.yaml`, shared `tsconfig.base.json`, Vitest root config with projects discovery, ESLint 9 + Prettier
2. ✅ **@d2/result** — D2Result pattern, error codes, HTTP status codes
3. ✅ **@d2/utilities** — Array/UUID/string helpers, cache constants
4. ✅ **@d2/protos** — Generated TS proto types + gRPC client stubs (Buf + ts-proto from `contracts/protos/`)
5. ✅ **@d2/testing** — Custom Vitest matchers (toBeSuccess, toBeFailure, etc.)
6. ✅ **@d2/shared-tests** — 161 tests covering result, utilities, protos, testing

**Step 2 — Logging, Telemetry, Handler Pattern (Layer 0-1)** ✅ 7. ✅ **@d2/logging** — ILogger interface with Pino implementation (auto-instrumented via OTel) 8. ✅ **@d2/service-defaults** — One-call OTel SDK bootstrap (`setupTelemetry()`), re-exports OTel API 9. ✅ **@d2/handler** — BaseHandler with OTel spans + metrics (duration, invocations, failures, exceptions) 10. ✅ **.NET BaseHandler metrics** — Same 4 metrics added to .NET for parity 11. ✅ **@d2/shared-tests** — 186 tests (25 new for logging + handler)

**Step 3 — Contracts (Layer 2)** ✅ 12. ✅ **@d2/interfaces** — Cache operation contracts: Get, Set, Remove, Exists, GetTtl, Increment (mirrors `D2.Shared.Interfaces`) 13. ✅ **@d2/result-extensions** — D2Result ↔ Proto conversions + gRPC call wrapper (mirrors `D2.Shared.Result.Extensions`) 14. ✅ **@d2/shared-tests** — 240 tests (54 new for interfaces + result-extensions, full branch coverage)

**Step 4 — Cache Implementations (Layer 3)** ✅ 15. ✅ **@d2/cache-memory** — MemoryCacheStore (Map + lazy TTL) + 5 handlers (Get, GetMany, Set, SetMany, Remove) 16. ✅ **@d2/cache-redis** — 6 handlers (Get, Set, Remove, Exists, GetTtl, Increment) via ioredis + pluggable ICacheSerializer 17. ✅ **@d2/shared-tests** — 290 tests (29 unit for cache-memory, 21 integration for cache-redis via @testcontainers/redis)

**Step 5 — Service Client + Messaging (Layer 0 + 4)** ✅ 12. ✅ **MemoryCacheStore LRU** — Always-on LRU eviction with maxEntries option (default 10,000) 13. ✅ **@d2/messaging** — Thin wrapper around rabbitmq-client: MessageBus with subscribe (consumer) + createPublisher 14. ✅ **@d2/geo-client** — Full 1:1 mirror of .NET Geo.Client: 9 CQRS handlers (SetInMem, SetInDist, SetOnDisk, GetFromMem, GetFromDist, GetFromDisk, ReqUpdate, FindWhoIs, Get), messaging handler (Updated), consumer bridge (createUpdatedConsumer), GeoRefDataSerializer 15. ✅ **@d2/shared-tests** — 375 tests (85 new for LRU, messaging, geo-client)

**Step 6 — Middleware (Layer 5)** ✅ 13. ✅ **@d2/request-enrichment** — IP resolution, fingerprinting, WhoIs lookup middleware for Hono (mirrors `RequestEnrichment.Default`) 14. ✅ **@d2/ratelimit** — Multi-dimensional sliding-window rate limiting middleware for Hono (mirrors `RateLimit.Default`) - Rate limit alerting scaffold (hook/callback for future notifications service)

**Step 7a — Polyglot Structure Alignment** ✅ 15. ✅ **@d2/interfaces restructuring** — Split flat `types.ts` files into TLC folder convention (`caching/{in-memory,distributed}/handlers/{c,d,r,u}/`), one handler per file 16. ✅ **Cache handler TLC folders** — Moved `@d2/cache-memory` and `@d2/cache-redis` handler files into `handlers/{d,r,u}/` subdirectories matching interface structure 17. ✅ **Middleware contracts to @d2/interfaces** — Moved `RateLimitDimension`, `IRequestInfo`, rate limit handler types from implementation packages to `@d2/interfaces` (`middleware/{ratelimit,request-enrichment}/`) 18. ✅ **@d2/geo-client interfaces directory** — Extracted handler types from inline definitions to dedicated `interfaces/{c,q,x,sub}/` structure mirroring .NET `Geo.Client/Interfaces/` 19. ✅ **Implementation directory restructuring** — Renamed flat implementation directories to `purpose/implementation` pattern (e.g., `ratelimit/default/`)

**Step 7b — Data Redaction Infrastructure** ✅ 20. ✅ **Node.js `RedactionSpec`** — New type in `@d2/handler` declaring handler redaction posture (inputFields, outputFields, suppressInput, suppressOutput) 21. ✅ **Node.js `BaseHandler` redaction** — Input/output field masking and suppression integrated into logging flow 22. ✅ **Node.js interface redaction specs** — Companion constants (`*_REDACTION`) on handler interfaces with required `redaction` property (compile-time enforcement) 23. ✅ **Node.js handler wiring** — All geo-client and ratelimit handlers implement `redaction` getter referencing interface constants 24. ✅ **.NET `RedactDataDestructuringPolicy`** — Serilog `IDestructuringPolicy` processing `[RedactData]` attributes (type-level + property-level, reflection-cached) 25. ✅ **.NET `DefaultOptions`** — Virtual `HandlerOptions` property on `BaseHandler`; null per-call options fall through to handler defaults 26. ✅ **.NET handler annotations** — `[RedactData]` on FindWhoIs I/O, `DefaultOptions` overrides on all ref data + rate limit handlers 27. ✅ **Tests** — 17 Node.js tests (handler redaction), 13 .NET tests (RedactDataDestructuringPolicy + DefaultOptions)

**Step 7c — Input Validation Infrastructure** ✅ 28. ✅ **Node.js `validateInput`** — Zod + `validateInput()` method on BaseHandler, common format validators (`isValidIpAddress`, `isValidGuid`, `zodHashId`, `zodEmail`, etc.) in `@d2/handler/validators` 29. ✅ **.NET common validator extensions** — FluentValidation `IRuleBuilder` extensions (`IsValidIpAddress`, `IsValidHashId`, `IsValidGuid`, etc.) in `D2.Handler/Validators.cs` 30. ✅ **.NET aggregate validators** — `ContactValidator`, `WhoIsValidator`, `LocationValidator` in `Geo.App/Validators/` with indexed error paths for bulk operations (`items[{i}].field`) 31. ✅ **Wired to all handlers** — 6 .NET Geo handlers (`CreateLocations`, `CreateContacts`, `CreateWhoIs`, `DeleteContacts`, `FindWhoIs`, `GetContactsByIds`) + 2 Node.js handlers (`FindWhoIs`, `RateLimit.Check`) 32. ✅ **Two-layer defense** — Fluent/Zod validation (Layer 1, must be ≥ as strict as domain) + per-item try/catch safety net (Layer 2) for bulk domain construction 33. ✅ **Tests** — 40+ new .NET handler validation tests (708 total Geo tests), 507 Node.js tests passing

> Tests are written and validated at each step — `@d2/shared-tests` grows as each layer is built.

### Phase 2: Auth Service + SvelteKit Integration

#### Build Order (decided 2026-02-08)

**Stage A — Foundations (cross-cutting, before auth service)**

1. **Retry utility** — General-purpose retrier in both `@d2/utilities` and `D2.Shared.Utilities` (ADR-006). Build now.
2. ~~**Idempotency middleware**~~ — ✅ `Idempotency-Key` header middleware (ADR-007). Implemented 2026-02-09.
3. **UUIDv7 generation** — Ensure both platforms have it ready. Node: `uuid` v7. .NET: `Guid.CreateVersion7()`.
4. **Proto contracts** — `contracts/protos/auth/v1/`. Wait until auth API surface is known from building the service.

**Stage B — Auth Service (bottom-up DDD layers)**

5. **auth-domain** — Domain types (User, Organization, Member, OrgType, Role, SessionContext, etc.). Pure types, no BetterAuth.
6. **auth-infra** — BetterAuth config, Kysely adapter, secondary storage adapter (wraps `@d2/cache-redis`), hooks (`generateId` UUIDv7, `forceAllowId`), custom table migrations (`org_contact`, `sign_in_event`, `emulation_consent`).
7. **auth-app** — Interfaces, CQRS handlers, mappers (BetterAuth→domain, domain→proto).
8. **auth-api** — Hono entry point, route mounting, composition root, gRPC server. Wire idempotency middleware here.
9. **auth-tests** — Unit + integration tests for all layers.

**Stage C — Client Libraries**

10. **@d2/auth-client** — BFF client for SvelteKit (proxy helper, JWT lifecycle, `createAuthClient`).
11. **@d2/auth-sdk** — Backend gRPC client for other Node.js services.
12. **.NET Auth.Client** — JWT validation via JWKS + `AddJwtBearer()`.

**Stage D — Integration**

13. **SvelteKit integration** — Proxy in `hooks.server.ts`, session population, route groups, onboarding flow.
14. **.NET gateway** — JWT validation middleware, CORS for SvelteKit origin.
15. **Notifications pipes** — Auth publishes events to RabbitMQ (e.g., `auth.email.verification`, `auth.email.password-reset`, `auth.email.invitation`). Consumer/notification service is a later deliverable — the "pipes" (event emission + message contracts) are wired during auth service build so the events flow even if nothing consumes them yet.

#### Auth Service — DDD Structure

The Auth Service follows the same DDD layering as Geo, with BetterAuth encapsulated in the infra layer:

```
backends/node/services/auth/
├── domain/            # @d2/auth-domain — Entities, value objects, domain types (the public contract)
├── app/               # @d2/auth-app — CQRS handlers, interfaces (TLC: implementations/cqrs/, interfaces/repository/, interfaces/geo/)
├── infra/             # @d2/auth-infra — BetterAuth config, repos, mappers (TLC: auth/better-auth/, repository/, mappers/)
├── api/               # @d2/auth-api — Hono entry point, routes, composition root, geo gateway impl
├── tests/             # @d2/auth-tests — Tests (unit + integration)
├── auth-client/       # @d2/auth-client — BFF client for SvelteKit (HTTP, proxy, JWT manager) [planned]
└── auth-sdk/          # @d2/auth-sdk — Backend client for other services (gRPC, like Geo.Client) [planned]
```

Mirrors .NET Geo:

```
Geo.Client / Geo.Domain / Geo.App / Geo.Infra / Geo.API / Geo.Tests
```

**Two client libraries** (auth serves two distinct consumer types):

| Client             | Package           | Consumers                    | Protocol | Purpose                                         |
| ------------------ | ----------------- | ---------------------------- | -------- | ----------------------------------------------- |
| **BFF Client**     | `@d2/auth-client` | SvelteKit                    | HTTP     | Auth proxy, session management, JWT lifecycle   |
| **Backend Client** | `@d2/auth-sdk`    | .NET gateway, other services | gRPC     | User/org lookups, JWT validation, JWKS fetching |

- `@d2/auth-client`: BFF-oriented. Proxies BetterAuth endpoints (`/api/auth/*`), manages JWT obtain/store/refresh, exposes `createAuthClient()` for SvelteKit. Works with **domain types** (tightly coupled, same codebase).
- `@d2/auth-sdk`: Service-oriented. gRPC stubs from `contracts/protos/auth/v1/`, handler-based (mirrors Geo.Client pattern). Works with **proto-generated types only** — no domain types exposed. Used by .NET services and future Node services that need auth data.
- **.NET side**: `Auth.Client` at `backends/dotnet/services/Auth/Auth.Client/` — gRPC client + JWT validation (`AddJwtBearer` + JWKS). Works with proto-generated C# types.

**Type boundary principle**: Domain types are internal to the auth service (and BFF). Backend consumers only see proto-generated types via gRPC. This prevents leaking domain logic between services — the proto contract IS the public API. Same pattern as Geo: `Geo.Domain` types are internal, `Geo.API` maps to proto responses, `Geo.Client` consumers only see proto types.

**Proto contracts**: `contracts/protos/auth/v1/` — auth service gRPC definitions. Mirrors `contracts/protos/geo/v1/` pattern. Needed for inter-service communication (e.g., notifications service querying user data, other services validating org membership). Service definitions will mirror how we handled Geo.

**Key design decisions:**

- **Framework-agnostic by design**: BetterAuth is an infra concern only. Domain and app layers have zero BetterAuth imports. If BetterAuth is ever swapped, only auth-infra changes.
- **Mappers in auth-app/auth-infra**: infra→domain (BetterAuth types → domain types, lives in auth-infra), domain→proto (domain types → gRPC responses, lives in auth-app). Similar to Geo's `LocationMapper`, `WhoIsMapper`, etc.
- **SignInEvent purge**: Scheduled job + handler (like other retention-based cleanup). 90-day retention.
- **Notifications service co-dependency**: Auth needs a notifications service scaffold for email verification, password reset, invitation emails. See "Notifications Service" section below.

**TLC concerns within auth-infra:**

```
auth-infra/src/
└── auth/                    # TLC concern: "Auth" (like "Repository", "Messaging")
    └── better-auth/         # Implementation (like "Pg", "MT", "Redis")
```

**Abstraction boundaries:**

- **Caching (Redis secondary storage)**: Fully abstracted. BetterAuth's `secondaryStorage` interface (`get`, `set`, `delete`) implemented by wrapping `@d2/interfaces` distributed cache handlers (IDistributedCacheGet, Set, Remove). auth-infra never imports ioredis directly.
- **Database (PostgreSQL)**: BetterAuth owns its DB connection via the built-in Kysely adapter with a dedicated `pg.Pool`. Give BetterAuth its own PG schema (`search_path=auth`). Accept BetterAuth's camelCase column naming internally — fighting it causes plugin compatibility issues (see Known Gotchas below). Custom `modelName` for table prefixes (e.g., `auth_users`, `auth_sessions`) is supported but has edge cases.
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

| Table               | Managed By  | Notes                                                 |
| ------------------- | ----------- | ----------------------------------------------------- |
| `user`              | BetterAuth  | Core; we add no custom fields                         |
| `account`           | BetterAuth  | Core; 1:N per user (multi-provider)                   |
| `session`           | BetterAuth  | Core + org plugin + 4 custom extension fields         |
| `verification`      | BetterAuth  | Email verification tokens (infra only, not in domain) |
| `jwks`              | BetterAuth  | JWT key pairs (infra only, not in domain)             |
| `organization`      | BetterAuth  | Org plugin + custom `type` field                      |
| `member`            | BetterAuth  | Org plugin; role stored as text                       |
| `invitation`        | BetterAuth  | Org plugin                                            |
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
- Purge via scheduled job or Kysely query

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

**Important**: When a user switches orgs or starts/stops emulation, the client must request a new JWT. The old JWT remains valid until its 15-minute expiry but carries stale org context. `@d2/auth-client` handles this: `setActiveOrg()` → `refreshJwt()` atomically.

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
- **Database adapter**: Built-in Kysely adapter with `pg.Pool` + dedicated PG schema (`search_path=auth`)
  - Kysely is BetterAuth's native adapter — zero extra packages, CLI `migrate` works directly
  - If issues arise, Drizzle adapter is the fallback (separate package, requires defining BA tables in Drizzle schema)
  - BetterAuth manages its own connection pool; auth-api provides the `Pool` at startup
  - `casing: "snake_case"` — matches our PG conventions
  - For our custom auth tables (`org_contact`, `sign_in_event`, `emulation_consent`), use the same Kysely instance
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
- Client-side JWT manager (part of `@d2/auth-client` — obtain, store in memory, auto-refresh)
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

#### Notifications Service (Phase 2 co-dependency)

Auth requires email sending for: verification, password reset, and invitation emails. Rather than building a throwaway email sender, we scaffold a notifications service with the right foundational shape so it can grow into a full multi-channel notification hub later.

**Reference**: DeCAF's `DeCAF.Features.Messaging.Default` (`/old/DeCAF-DCSV/BE_NET/`)

**DeCAF messaging pattern** (notification hub):

```
Notify (orchestrator)
  ├─ Reads user notification preferences
  ├─ Routes to enabled channels:
  │  ├─ Email:  Notify → EnqueueEmail → TrySendEmail (with retry)
  │  ├─ SMS:    Notify → EnqueueSms → TrySendSMS (with retry)
  │  ├─ Push:   Notify → SendPushNotification
  │  └─ In-app: Notify → CreateDirectMessage / SupportMessage
  └─ Partial success (channels fail independently)

Background retry: scheduled job finds "Retrying" messages, re-attempts delivery
Message states: Pending → Sent | Retrying → Sent | Failed
```

**Phase 2 scaffold** (minimum viable for auth):

- **Email channel only** — verification, password reset, invitation emails
- **Provider abstraction** — `IEmailProvider` interface (swap SMTP/SendGrid/SES later)
- **Template abstraction** — `ITemplateProvider` interface (compile templates with variables)
- **Enqueue + retry** — persist to DB, attempt immediate send, background retry on failure
- **Notification preferences** — user-level settings (at minimum: email enabled/disabled)

**Foundational shape to preserve** (so we don't redo later):

- Multi-channel `Notify` orchestrator entry point (even if only email is wired initially)
- Channel-agnostic message envelope (recipient, channel, template, variables)
- Provider pattern for each channel (pluggable implementations)
- Retry with configurable max attempts and backoff intervals
- RabbitMQ integration for async dispatch (auth publishes, notifications consumes)

**NOT needed in Phase 2**: SMS, push notifications, in-app messaging, SignalR real-time, support chat. These are Phase 3+ features that plug into the existing foundation.

### Phase 3: Auth Features (Future)

1. **Session management UI** (list sessions, revoke individual, revoke all others)
2. **Org emulation** (support/admin can view any org's data in read-only mode)
3. **User impersonation** (escalated support — act as a specific user, audit-logged, time-limited)
4. **Admin control panel** (cross-org visibility, user/org management, system diagnostics)
5. **Admin alerting** (rate limit threshold alerts via notifications service)
6. **Notifications expansion** — SMS, push, in-app messaging, SignalR real-time, support chat

### Completed Phases

**Phase: .NET Gateway Infrastructure** ✅

- RequestEnrichment.Default middleware (IP resolution, fingerprinting, WhoIs lookup)
- RateLimit.Default middleware (sliding-window with abstracted distributed cache)
- Distributed cache abstractions (GetTtl, Increment handlers)
- Geo.Client WhoIs cache handler (FindWhoIs with IMemoryCache + gRPC fallback)
- REST Gateway integration (all middleware wired up)
- 600+ tests passing

**Phase: Geo Service** ✅

- WhoIs handlers (Repository + CQRS + FindWhoIs complex handler with external API)
- Contact handlers (Repository + CQRS + Create/Delete/GetByIds/GetByExtKeys)
- Location handlers (Repository + CQRS + CreateLocations)
- Geo.Client library (service-owned client with messages, interfaces, default implementations)

---

## Technical Debt

| Item                           | Priority   | Notes                                                                                                                                                                                                 |
| ------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Validate redaction in OTEL** | **High**   | Manually verify in Grafana/Loki that no PII (IPs, fingerprints) appears in production log output                                                                                                      |
| **Geo location cleanup job**   | **Medium** | Background job to remove locations with zero references (no contacts or WhoIs). Geo-owned responsibility. Auth deletes contacts on org_contact deletion; Geo cleans up orphaned locations separately. |
| Test container sharing         | Medium     | Could speed up integration tests                                                                                                                                                                      |
| Standardize error codes        | Medium     | Ensure consistency across services                                                                                                                                                                    |

---

## Resolved Questions

1. **Session storage**: ✅ **Both** — PostgreSQL as primary (audit trail, durability), Redis as secondary storage (fast lookups, near-instant revocation), cookie cache (5min, compact strategy) for eliminating ~95% of storage lookups. BetterAuth's `storeSessionInDatabase: true` enables dual-write.

2. **Refresh token strategy**: ✅ BetterAuth uses a **session-based model**, not access+refresh tokens. Sessions last 7 days with 1-day `updateAge` (auto-refresh on activity). **JWTs are separate** — 15-minute RS256 tokens issued via the JWT plugin for service-to-service auth. No refresh token for JWTs; the client simply requests a new one using their valid session.

3. **Multi-device sessions**: ✅ **Yes** — supported OOTB by BetterAuth. `listSessions()` returns all active sessions with IP + userAgent. Individual session revocation (`revokeSession`), bulk revocation (`revokeOtherSessions`, `revokeSessions`), and revocation on password change are all built-in.

4. **Rate limit alerting**: ✅ **Scaffold only** — create a hook/callback point in the rate limiting flow that calls a `[future notifications service]`. The real implementation comes later when auth + email verification land and we know who the admins are to alert. No specific threshold decided yet.

5. **Last-owner protection**: ✅ **Blocked from leaving**. Last owner presented two options: (a) transfer ownership to another member (email confirmation required, then original owner can leave), or (b) delete the org entirely (email confirmation required).

6. **Notifications service scope**: ✅ **Foundational scaffold with email-only**. Shape mirrors DeCAF's notification hub pattern (multi-channel Notify orchestrator, provider abstraction, enqueue + retry, user preferences). Phase 2 wires email only; SMS/push/in-app/SignalR are Phase 3+ plugins into the same foundation.

7. **Retry pattern**: ✅ **General-purpose utility, opt-in, exponential backoff** (1s→2s→4s→8s). Transient-only (5xx, timeout, 429). No retry on 4xx. Both platforms. See ADR-006.

8. **Idempotency**: ✅ **`Idempotency-Key` header middleware** on external-facing endpoints (gateway + auth). Redis-backed with 24h TTL. See ADR-007.

9. **Sign-up ordering**: ✅ **Contact BEFORE user**. Pre-generate UUIDv7, create Geo contact first, then user in BetterAuth. Orphaned contacts are harmless. Fail sign-up entirely if Geo unavailable. See ADR-008.

10. **BetterAuth custom IDs**: ✅ **Supported** via `advanced.database.generateId` (global UUIDv7) + `databaseHooks.user.create.before` with `forceAllowId: true` (per-request ID injection). See ADR-008 for details and GitHub references.

11. **Race conditions during sign-up**: ✅ **DB unique constraint on email is sufficient**. No distributed locks needed. Whoever hits the constraint first wins.

12. **Async pattern**: ✅ **Hybrid** — sync gRPC for critical path (contact creation, user creation), async RabbitMQ for side effects (email notifications, audit events).

## Open Questions

1. ✅ **RS256 JWT interop**: **Validated** (2026-02-22). JWT header contains `"alg": "RS256"` (confirmed, not `"RSA256"`). JWKS table stores RSA key pairs (`kty: "RSA"`, modulus + exponent present). JWT has valid `iss`, `aud`, `iat`, `exp` claims compatible with .NET `AddJwtBearer()`. `typ` field may be omitted (allowed per RFC 7519). Full .NET validation deferred to E2E test when gateway is wired.

2. ✅ **Session lifecycle**: **Validated** (2026-02-22). Full lifecycle tested: create (sign-in → DB row), update (setActiveOrganization → `active_organization_id` updated), revoke (session removed from DB), list (returns active sessions), revoke-others (keeps current, removes rest), multiple concurrent sessions per user. All working with `storeSessionInDatabase: true` against real PostgreSQL. Secondary storage (Redis) tested separately in `secondary-storage.test.ts`. Re-test after BetterAuth upgrades.

3. ✅ **Custom session fields + cookie cache**: **Partially validated** (2026-02-22). `additionalFields` columns exist in DB and can be written/read. `getSession` returns them correctly when populated. **KEY FINDING**: BetterAuth's `setActiveOrganization` ONLY sets `activeOrganizationId` — our custom fields (`activeOrganizationType`, `activeOrganizationRole`) are NOT auto-populated. App-layer code must update the session after org switch (e.g., hook or custom route wrapper that looks up org type + member role → updates session row). Cookie cache persistence of `additionalFields` requires BetterAuth version containing PR #5735 (merged Nov 2025 canary). **TODO**: Implement post-`setActiveOrganization` hook in Stage C.

4. ✅ **`definePayload` session access**: **Validated** (2026-02-22). `definePayload` receives `({ user, session })` — both parameters confirmed working. `session` contains `activeOrganizationId` (BetterAuth OOTB) and our custom `additionalFields` (when populated). `user` contains `id`, `email`, `username`. JWT claims are correctly derived from both. Org context claims (`orgType`, `role`) in JWT depend on session fields being populated by app-layer code (see Q3).

5. **Emulation/impersonation implementation details**: Authorization model decided (org emulation = read-only no consent, user impersonation = user-level consent, admin bypass). Remaining: should impersonation require 2FA? Should there be a max impersonation duration? How does `emulation_consent` integrate with BetterAuth's `impersonation` plugin hooks?

6. ✅ **`snake_case` + org/impersonation plugins**: **Validated** (2026-02-22). All 6 tables tested with explicit snake_case column queries: `user` (email_verified, created_at, display_username, ban_reason, ban_expires), `account` (user_id, provider_id, account_id, access_token, refresh_token, access_token_expires_at), `session` (user_id, ip_address, user_agent, active_organization_id, active_organization_type, active_organization_role, emulated_organization_id, emulated_organization_type), `organization` (org_type, created_at), `member` (user_id, organization_id, created_at), `invitation` (organization_id, inviter_id, expires_at). All pass with our plugin set (bearer, username, jwt, organization, admin).

7. ✅ **Pre-generated user ID**: **Validated** (2026-02-22). The `databaseHooks.user.create.before` hook sets `data.id` and returns `{ data }` — BetterAuth preserves the ID **without** needing `forceAllowId: true`. The hook-provided userId matches the created user's ID in DB. E2E sign-up tests (contact-before-user flow) also pass. No AsyncLocalStorage needed — the hook generates/reads the ID directly.

8. **Geo location cleanup job**: ✅ **Decided** — Geo-owned background job removes locations with zero references (no contacts or WhoIs entries pointing to them). Contacts themselves are cleaned up by Auth on org_contact deletion. Still TODO: implement the actual Geo background job.

---

## Meeting Notes / Decisions Log

### 2026-02-10

- **Auth service structural alignment completed**: TLC folder convention + org contact rework + sign-in caching
  - auth-app: Restructured from flat `handlers/` to `implementations/cqrs/handlers/{c,q}/`, `interfaces/repository/`, `interfaces/geo/`
  - auth-infra: Restructured from flat root to `auth/better-auth/`, `repository/{handlers,entities,migrations}/`, `mappers/`
  - Org contact handlers use `@d2/geo-client` handler interfaces directly (no gateway abstraction)
  - Contact caching via geo-client's `MemoryCacheStore` (immutable, no TTL, LRU eviction)
  - `CreateOrgContact` reworked: takes full contact details → creates Geo contact via gRPC → creates junction
  - `DeleteOrgContact` reworked: deletes junction → best-effort Geo contact cleanup
  - `UpdateOrgContact` reworked: metadata-only or contact replacement (create new → repoint → delete old)
  - `GetOrgContacts` reworked: hydrates junction records with full Geo contact data via batch gRPC fetch
  - `GetSignInEvents` reworked: local memory cache with staleness check (latest event date comparison, 5min TTL)
  - Composition root updated: `MemoryCacheStore` for sign-in caching, `@d2/geo-client` contact handlers for org contacts
  - 440 auth tests passing (23 new/updated: geo integration, caching, hydration, contact replacement)
  - AUTH.md updated to reflect all changes

### 2026-02-08

- **Step 7c completed**: Input Validation Infrastructure across both platforms
  - Node.js: Zod + `validateInput()` on BaseHandler, common format validators in `@d2/handler/validators`
  - .NET: FluentValidation `IRuleBuilder` extensions in `D2.Handler/Validators.cs`
  - .NET: Aggregate validators (ContactValidator, WhoIsValidator, LocationValidator) in `Geo.App/Validators/`
  - Wired to 6 .NET Geo handlers + 2 Node.js handlers
  - Two-layer defense: Fluent/Zod validation + per-item try/catch safety net for bulk domain construction
  - 40+ new .NET handler validation tests (708 total Geo tests), 507 Node.js tests
- **Async pattern decided**: Hybrid sync/async
  - Critical path (contact creation, user creation): sync gRPC with retry + exponential backoff
  - Side effects (email notifications, audit events): async via RabbitMQ (eventual delivery)
  - If Geo unavailable during sign-up: fail entirely (no stale users)
  - SignalR: only when concrete real-time push need exists (not sign-up)
- **Sign-up flow ordering decided**: Contact BEFORE user (ADR-008)
  - Pre-generate UUIDv7 for userId
  - Create Geo Contact with pre-generated userId
  - Then create user in BetterAuth with `forceAllowId: true`
  - Orphaned contacts (failed user creation) are harmless noise
  - DB unique constraint on email sufficient for race conditions (no distributed locks)
- **BetterAuth custom ID research completed**:
  - `advanced.database.generateId`: Global UUIDv7 for all BetterAuth tables
  - `databaseHooks.user.create.before` + `forceAllowId: true`: Per-request ID injection
  - Three approaches evaluated: (A) before hook + forceAllowId, (B) custom sign-up route, (C) generateId + after hook with rollback
  - Recommended: A — before hook + forceAllowId is simplest and officially supported
  - GitHub refs: #2881 (forceAllowId works), #1060 (maintainer notes), #2098 (hook data fixed)
- **Retry/resilience pattern decided** (ADR-006): General-purpose utility, opt-in, exponential backoff (1s→2s→4s→8s), transient-only retry
- **Idempotency pattern decided** (ADR-007): `Idempotency-Key` header middleware, Redis-backed, 24h TTL, external-facing endpoints only
- **All tests passing**: 507 Node.js + 1084 .NET (708 Geo + 376 shared)

### 2026-02-07

- **Phase 2 research completed**: DI patterns + BetterAuth customization deep-dive
  - **DI decision: Manual factory functions** — each package exports `createXxxHandlers(deps, context)` matching .NET's `services.AddXxx()`. No DI library needed. Backup: `@snap/ts-inject` if complexity grows. Rejected: tsyringe, inversify (decorator-based), hono-netdi (too new + decorators).
  - **BetterAuth database adapter: Kysely** (built-in) — NOT Drizzle. Kysely is BetterAuth's native adapter, supports CLI `migrate`, fewer edge cases. Dedicated PG schema (`search_path=auth`).
  - **BetterAuth casing: Use `casing: "snake_case"`** — matches PostgreSQL conventions. Known casing bugs (#5649) only affect SSO/OIDC plugins we don't use. Validate early with our plugin set. Own PG schema isolates any edge cases.
  - **Secondary storage: Wraps `@d2/interfaces`** — BetterAuth's `SecondaryStorage` is just `{ get, set, delete }`. Trivially wraps our distributed cache handlers.
  - **JWT algorithm: `"RS256"`** (standard JOSE name) — BetterAuth docs may show `"RSA256"` (typo). Code passes alg directly to jose which requires `"RS256"`. Need early interop test with .NET.
  - **Known gotchas documented**: 8 HIGH/MODERATE GitHub issues affecting session sync, schema casing, and JWKS caching. All manageable but need testing.
  - **Hono integration**: Route-based mount (`auth.handler(c.req.raw)`), CORS before routes, session middleware via `auth.api.getSession()`. First-class support, no adapter needed.
- **Auth domain model designed**: Multi-tenant, multi-org architecture
  - **Flat orgs, 5 types**: admin, support, customer, third_party, affiliate. Org type is a custom DB field, not hierarchy.
  - **Business relationships between orgs** (e.g., customer → third_party) tracked in domain layer, not auth layer. All orgs are peers at the auth level.
  - **4 custom roles**: auditor (read-only), agent (limited write), officer (full write), owner (everything). Composed via `createAccessControl`, no hierarchy syntax needed.
  - **Session extensions**: 4 custom fields (activeOrganizationType, activeOrganizationRole, emulatedOrganizationId, emulatedOrganizationType).
  - **Org emulation**: Support/admin can view any org read-only. Forces auditor role. Audit-logged.
  - **User impersonation**: BetterAuth `impersonation` plugin for escalated support. Separate from emulation.
  - **No-org onboarding state**: New users must join or create an org before accessing features.
  - **SvelteKit UI sharding**: Route groups by org type — `(customer)/`, `(support)/`, `(admin)/`, etc.
  - **JWT includes org context**: activeOrganizationId, type, role, emulation state. Client re-fetches JWT on org switch.
  - **BetterAuth org plugin gap analysis**: 75% OOTB fit. Gaps (org type, session fields, emulation, JWT+org) all bridgeable with hooks and custom fields.
- **Contact architecture decided**: Auth stores NO contact data. Geo's Contact references userId directly for users. For orgs, auth has a thin `org_contact` junction (id, orgId, label, isPrimary). Geo's Contact references `org_contact.id`. Keeps auth thin.
  - **Sign-in audit designed**: Flat `sign_in_event` table (userId, successful, ipAddress, userAgent, whoIsId). Leverages existing `FindWhoIs` for location context. Failed attempts with unknown users have null userId.
  - **Emulation consent model decided**: USER-level (not org-level). `emulation_consent` table (userId, grantedToOrgId, expiresAt, revokedAt). Support needs consent; admin bypasses. Org emulation (read-only) requires no consent at all.
  - **Two-mode access model**: Org emulation (read-only, no consent, forced auditor) vs User impersonation (act-as-user, user consent required for support, admin bypass).
  - **Domain aggregates finalized**: User aggregate (accounts[], sessions[], memberships[], invitations[], signInEvents[], emulationConsents[]) and Organization aggregate (members[], invitations[], contacts[]). Member + Invitation bidirectional — Org is write owner, User has read navigation.
  - **Business rules decided**: Only `customer` orgs self-created, `third_party` via workflow, rest admin-only. 90-day sign-in event retention. 7-day invitation expiry. One account per provider. Member removal = immediate session termination.
  - **OrgType/Role as text in PG** (not PG enums) — avoids migration pain. TS string unions for compile-time safety.
  - **Two auth client libraries**: `@d2/auth-client` (BFF for SvelteKit, HTTP) + `@d2/auth-sdk` (backend for services, gRPC). Plus .NET `Auth.Client`.
  - **Proto contracts**: `contracts/protos/auth/v1/` — auth will have gRPC endpoints for inter-service communication.
  - **Notifications co-dependency**: Auth needs notifications scaffold for email verification, password reset, invitation emails.
  - **Database**: Kysely (BetterAuth native) with `casing: "snake_case"`. Drizzle as fallback if issues arise.
  - **Last-owner protection**: Blocked from leaving. Options: transfer ownership (email confirmation) or delete org (email confirmation).
  - **Type boundary**: Domain types internal to auth service + BFF. Backend clients (`@d2/auth-sdk`, .NET `Auth.Client`) only see proto-generated types. Proto contract is the public API.
  - **Notifications service shape**: Mirrors DeCAF notification hub (multi-channel Notify orchestrator, provider pattern, enqueue+retry). Phase 2 = email only. Foundation supports future SMS/push/in-app/SignalR.
  - **Invitation lifecycle**: 7-day expiry, accept or reject. Expired invitations cleaned up.
  - **Onboarding flow**: Signup (email/Google/LinkedIn) → email verify → create `customer` org or accept invite.
- **PII redaction sweep**: Fixed 11 log statements across .NET + Node.js that leaked IPs/fingerprints. Added 4 validation tests. Tech debt: manual OTEL log validation.
- **CI workflow**: 6 parallel test jobs with D2 prefix + v1 suffix for branch protection discoverability
- **RabbitMQ integration tests fixed**: consumer `ready` signaling, explicit credentials, no-op error listener for NACK path
- **All tests passing**: 476 Node.js + 928 .NET

### 2026-02-06

- **Phase 1, Step 2 completed**: Logging, Telemetry, Handler Pattern (Layer 0-1) all done
  - @d2/logging: ILogger interface decoupled from Pino, auto-instrumented via OTel
  - @d2/service-defaults: One-call `setupTelemetry()` bootstrap, re-exports OTel API
  - @d2/handler: BaseHandler with OTel spans + 4 metrics (duration histogram, invocations/failures/exceptions counters)
  - .NET BaseHandler: Same 4 metrics added for parity, registered in ServiceDefaults
  - 186 TS tests passing (25 new), 595 .NET tests passing (4 new for Populate subdivision resolution)
- **Phase 1, Step 1 completed**: Workspace + Foundation (Layer 0) packages all done
  - @d2/result, @d2/utilities, @d2/protos, @d2/testing, @d2/shared-tests (161 tests)
- **ESLint 9 + Prettier configured**: Root-level monorepo config covering all Node.js packages + web client
  - Web client's local ESLint config consolidated into root
  - Prettier settings: double quotes, 2 spaces, CRLF, 100-char print width
- **Additional .NET fixes**:
  - REST gateway: Added IHandlerContext DI registration (AddHandlerContext)
  - Populate handler: Added subdivision code resolution via GeoRef + in-memory cache
  - Populate handler: Fixed DI by using interface types for cache handlers
  - Converted string.IsNullOrWhiteSpace to Truthy()/Falsey() in Populate
- **Next up**: Layer 2 packages (@d2/interfaces, @d2/result-extensions)
- **Phase 1, Step 3 completed**: Contracts (Layer 2) packages done
  - @d2/interfaces: In-memory (Get, GetMany, Set, SetMany, Remove) + Distributed (Get, Exists, GetTtl, Set, Increment, Remove)
  - @d2/result-extensions: d2ResultToProto, d2ResultFromProto, handleGrpcCall (ServiceError detection)
  - 240 TS tests passing (54 new), full branch coverage on all result-extensions code
- **Next up**: Layer 3 cache implementations (@d2/cache-memory, @d2/cache-redis)
- **Phase 1, Step 4 completed**: Cache Implementations (Layer 3) done
  - @d2/cache-memory: MemoryCacheStore (Map + lazy TTL eviction) + 5 handlers extending BaseHandler
  - @d2/cache-redis: 6 handlers via ioredis + pluggable ICacheSerializer (JSON default, binary proto support)
  - 290 TS tests passing (29 unit for memory, 21 integration for Redis via @testcontainers/redis)
  - tsconfig extends path fixed: 4 levels up from implementations/caching/\*/ to backends/node/
- **Next up**: Layer 4 service client (@d2/geo-cache)
- **Phase 1, Step 5 completed**: Service Client + Messaging (Layer 0 + 4) done
  - MemoryCacheStore: always-on LRU with maxEntries option (default 10,000), Map insertion-order trick
  - @d2/messaging: thin rabbitmq-client wrapper with MessageBus, subscribe, createPublisher
  - @d2/geo-client: full 1:1 .NET Geo.Client parity with 9 CQRS handlers, Updated messaging handler, consumer bridge
  - GeoRefDataSerializer for protobuf binary Redis serialization
  - ESLint: added argsIgnorePattern/varsIgnorePattern for \_ prefix convention
  - pnpm-workspace.yaml: services/\* → services/\*\* for nested packages like geo/geo-client
  - 375 TS tests passing (85 new), all passing with lint + format clean
- **Next up**: Layer 5 middleware (@d2/request-enrichment, @d2/ratelimit)
- **Phase 1, Step 6 completed**: Middleware (Layer 5) done
  - @d2/request-enrichment: IP resolution, fingerprinting, WhoIs lookup middleware for Hono
  - @d2/ratelimit: Multi-dimensional sliding-window rate limiting with abstracted cache handlers
  - 437 TS tests passing (62 new for request-enrichment + ratelimit)
- **Phase 1, Step 7a completed**: Polyglot Structure Alignment
  - @d2/interfaces: Restructured from flat types.ts to TLC folder convention (one handler per file)
  - Cache handlers: Moved into TLC subdirectories (handlers/{d,r,u}/) matching interfaces
  - Middleware contracts: Moved RateLimitDimension, IRequestInfo, check handler types to @d2/interfaces
  - @d2/geo-client: Extracted interfaces into dedicated interfaces/{c,q,x,sub}/ directories mirroring .NET
  - Implementation dirs: Restructured to purpose/implementation pattern (e.g., ratelimit/default/)
  - All tests reformatted and verified passing
- **Phase 1, Step 7b completed**: Data Redaction Infrastructure
  - Node.js: RedactionSpec type in @d2/handler, BaseHandler field masking + suppression
  - Node.js: Companion \*\_REDACTION constants on interfaces, interface narrowing for compile-time enforcement
  - Node.js: All geo-client + ratelimit handlers wired with redaction getters
  - .NET: RedactDataDestructuringPolicy (Serilog IDestructuringPolicy, reflection-cached)
  - .NET: DefaultOptions virtual property on BaseHandler, null per-call falls through to handler defaults
  - .NET: [RedactData] on FindWhoIs I/O, DefaultOptions overrides on all ref data + rate limit handlers
  - 445 TS tests passing (8 new), 289 .NET tests passing (11 new)
- **Next up**: Phase 2 (Auth Service)

### 2026-02-05

- **Session management architecture decided**: 3-tier storage (cookie cache → Redis → PostgreSQL)
  - Cookie cache: 5min, compact strategy (~95% of lookups eliminated)
  - Redis: secondary storage for fast lookups + near-instant revocation
  - PostgreSQL: `storeSessionInDatabase: true` for audit trail + durability
- **JWT config decided**: RS256 (native .NET support), 15min expiry, JWKS at `/api/auth/jwks`
  - EdDSA rejected (BetterAuth default) because `Microsoft.IdentityModel.Tokens` lacks native support
- **Request flow decided**: Pattern C (hybrid BFF + direct gateway) — ADR-005
  - SSR / slow-changing data: SvelteKit server → .NET Gateway (server-side JWT)
  - Interactive client-side: Browser → .NET Gateway directly (client-side JWT)
  - Auth always proxied through SvelteKit (cookie-based, first-party)
- **Session revocation**: Individual session revocation supported (server-side API for non-current sessions)
- **Rate limit alerting**: Scaffold only — hook for future notifications service
- **Multi-device sessions**: OOTB with BetterAuth, `listSessions()` + individual revocation
- **Phase ordering clarified**: TypeScript shared infra (ratelimit, geo-cache) BEFORE auth service
- All 4 prior open questions resolved

### 2025-02-04

- Removed Keycloak from infrastructure
- Decided on BetterAuth with standalone Auth Service
- Decided on multi-dimensional rate limiting with Redis
- Decided on proxy pattern for SvelteKit ↔ Auth Service
- Created this planning document

---

_Last updated: 2026-02-10_
