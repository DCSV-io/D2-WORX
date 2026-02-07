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
- `@d2/geo-cache` (Node.js), `D2.Geo.Cache` (C#)
- LRU cache with 1-hour TTL, 1000 entry limit
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

| Package                    | Status     | Location                                                              | .NET Equivalent                          |
| -------------------------- | ---------- | --------------------------------------------------------------------- | ---------------------------------------- |
| **@d2/result**             | ✅ Done    | `backends/node/shared/result/`                                        | `D2.Shared.Result`                       |
| **@d2/utilities**          | ✅ Done    | `backends/node/shared/utilities/`                                     | `D2.Shared.Utilities`                    |
| **@d2/protos**             | ✅ Done    | `backends/node/shared/protos/`                                        | `Protos.DotNet`                          |
| **@d2/testing**            | ✅ Done    | `backends/node/shared/testing/`                                       | `D2.Shared.Tests` (infra)                |
| **@d2/shared-tests**       | ✅ Done    | `backends/node/shared/tests/`                                         | `D2.Shared.Tests` (tests)                |
| **@d2/logging**            | ✅ Done    | `backends/node/shared/logging/`                                       | `Microsoft.Extensions.Logging` (ILogger) |
| **@d2/service-defaults**   | ✅ Done    | `backends/node/shared/service-defaults/`                              | `D2.Shared.ServiceDefaults`              |
| **@d2/handler**            | ✅ Done    | `backends/node/shared/handler/`                                       | `D2.Shared.Handler`                      |
| **@d2/interfaces**         | ✅ Done    | `backends/node/shared/interfaces/`                                    | `D2.Shared.Interfaces`                   |
| **@d2/result-extensions**  | ✅ Done    | `backends/node/shared/result-extensions/`                             | `D2.Shared.Result.Extensions`            |
| **@d2/cache-memory**       | ✅ Done    | `backends/node/shared/implementations/caching/in-memory/default/`     | `InMemoryCache.Default`                  |
| **@d2/cache-redis**        | ✅ Done    | `backends/node/shared/implementations/caching/distributed/redis/`     | `DistributedCache.Redis`                 |
| **@d2/messaging**          | ✅ Done    | `backends/node/shared/messaging/`                                     | MassTransit (thin rabbitmq-client wrap)  |
| **@d2/geo-client**         | ✅ Done    | `backends/node/services/geo/geo-client/`                              | `Geo.Client` (full parity)               |
| **@d2/request-enrichment** | ✅ Done    | `backends/node/shared/implementations/middleware/request-enrichment/default/` | `RequestEnrichment.Default`              |
| **@d2/ratelimit**          | ✅ Done    | `backends/node/shared/implementations/middleware/ratelimit/default/`          | `RateLimit.Default`                      |
| **@d2/auth-client**        | 📋 Phase 2 | TBD                                                                   | —                                        |
| **@d2/jwt-manager**        | 📋 Phase 2 | TBD                                                                   | —                                        |

### Services

| Service          | Status     | Notes                                                         |
| ---------------- | ---------- | ------------------------------------------------------------- |
| Geo.Domain       | ✅ Done    | Entities, value objects                                       |
| Geo.App          | ✅ Done    | CQRS handlers, mappers                                        |
| Geo.Infra        | ✅ Done    | Repository, messaging                                         |
| Geo.API          | ✅ Done    | gRPC service                                                  |
| Geo.Client       | ✅ Done    | Service-owned client library (messages, interfaces, handlers) |
| Geo.Tests        | ✅ Done    | 595 tests passing                                             |
| **Auth Service** | 📋 Planned | Node.js + Hono + BetterAuth (`backends/node/services/auth/`)  |
| **Auth.Tests**   | 📋 Planned | Auth service tests (`backends/node/services/auth-tests/`)     |

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

> Tests are written and validated at each step — `@d2/shared-tests` grows as each layer is built.

### Phase 2: Auth Service + SvelteKit Integration

1. **Auth Service** (`backends/node/services/auth/`)
   - Hono + BetterAuth
   - PostgreSQL adapter (d2-auth-db)
   - Redis secondary storage (3-tier session management, see ADR-001)
   - Plugins: `bearer` + `jwt` (RS256, 15min, JWKS at `/api/auth/jwks`)
   - Cookie cache: 5min, compact strategy
   - Session: 7-day expiry, 1-day updateAge
   - Key rotation: 30-day intervals, 30-day grace period
   - Session management endpoints: list, revoke individual, revoke others, revoke all

2. **SvelteKit Auth Integration**
   - Auth proxy in `hooks.server.ts` (`/api/auth/*` → Auth Service)
   - Session population hook (forward cookie to Auth Service for validation, or decode cookie cache locally)
   - `createAuthClient` setup (no `baseURL` needed — same-origin proxy)
   - Client-side JWT manager utility (obtain, store in memory, auto-refresh)
   - CORS configuration for direct gateway access (Pattern C, ADR-005)

3. **.NET Gateway JWT Validation**
   - `AddJwtBearer()` with JWKS from Auth Service
   - RS256 validation (native `Microsoft.IdentityModel.Tokens`)
   - CORS middleware for SvelteKit origin
   - JWKS caching with periodic refresh

### Phase 3: Auth Features (Future)

1. **Email verification** (requires notifications service scaffold)
2. **Password reset flow**
3. **Session management UI** (list sessions, revoke individual, revoke all others)
4. **Admin alerting** (rate limit threshold alerts via notifications service)

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

| Item                    | Priority | Notes                              |
| ----------------------- | -------- | ---------------------------------- |
| Test container sharing  | Medium   | Could speed up integration tests   |
| Standardize error codes | Medium   | Ensure consistency across services |

---

## Resolved Questions

1. **Session storage**: ✅ **Both** — PostgreSQL as primary (audit trail, durability), Redis as secondary storage (fast lookups, near-instant revocation), cookie cache (5min, compact strategy) for eliminating ~95% of storage lookups. BetterAuth's `storeSessionInDatabase: true` enables dual-write.

2. **Refresh token strategy**: ✅ BetterAuth uses a **session-based model**, not access+refresh tokens. Sessions last 7 days with 1-day `updateAge` (auto-refresh on activity). **JWTs are separate** — 15-minute RS256 tokens issued via the JWT plugin for service-to-service auth. No refresh token for JWTs; the client simply requests a new one using their valid session.

3. **Multi-device sessions**: ✅ **Yes** — supported OOTB by BetterAuth. `listSessions()` returns all active sessions with IP + userAgent. Individual session revocation (`revokeSession`), bulk revocation (`revokeOtherSessions`, `revokeSessions`), and revocation on password change are all built-in.

4. **Rate limit alerting**: ✅ **Scaffold only** — create a hook/callback point in the rate limiting flow that calls a `[future notifications service]`. The real implementation comes later when auth + email verification land and we know who the admins are to alert. No specific threshold decided yet.

## Open Questions

_(None currently — all prior questions resolved 2026-02-05)_

---

## Meeting Notes / Decisions Log

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
  - Node.js: Companion *_REDACTION constants on interfaces, interface narrowing for compile-time enforcement
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

_Last updated: 2026-02-06_
