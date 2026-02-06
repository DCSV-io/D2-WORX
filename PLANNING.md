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
1. **Node.js Workspace Setup** - pnpm workspaces, shared TypeScript config in `backends/node/`
2. **Auth Service Implementation** - Standalone Node.js + Hono + BetterAuth at `backends/node/services/auth/`
3. **SvelteKit Auth Integration** - Proxy pattern (`/api/auth/*` → Auth Service)

### Recently Completed
- ✅ Request enrichment middleware (IP resolution, fingerprinting, WhoIs lookup)
- ✅ Multi-dimensional rate limiting middleware (sliding-window algorithm)
- ✅ Geo.Client WhoIs cache handler (`FindWhoIs` with IMemoryCache + gRPC fallback)
- ✅ Distributed cache abstractions (GetTtl, Increment handlers)
- ✅ REST Gateway integration (enrichment + rate limiting wired up)

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

| Plugin    | Purpose                                                    |
|-----------|------------------------------------------------------------|
| `bearer`  | Session token via `Authorization` header (for API clients) |
| `jwt`     | Issues 15min RS256 JWTs for service-to-service auth        |

**Important distinction:** The Bearer plugin uses the *session token* (opaque, validated via DB/Redis lookup). The JWT plugin issues *signed JWTs* (stateless, validated via JWKS public key). They serve different purposes and are both needed.

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

| Component | Status | Notes |
|-----------|--------|-------|
| PostgreSQL 18 | ✅ Done | Aspire-managed |
| Redis 8.2 | ✅ Done | Aspire-managed |
| RabbitMQ 4.1 | ✅ Done | Aspire-managed |
| MinIO | ✅ Done | Aspire-managed |
| LGTM Stack | ✅ Done | Full observability |
| ~~Keycloak~~ | ❌ Removed | Replaced by BetterAuth |

### Shared Packages (.NET)

| Package | Status | Location |
|---------|--------|----------|
| D2.Result | ✅ Done | `backends/dotnet/shared/Result/` |
| D2.Result.Extensions | ✅ Done | `backends/dotnet/shared/Result.Extensions/` |
| D2.Handler | ✅ Done | `backends/dotnet/shared/Handler/` |
| D2.Interfaces | ✅ Done | `backends/dotnet/shared/Interfaces/` (includes GetTtl, Increment) |
| D2.Utilities | ✅ Done | `backends/dotnet/shared/Utilities/` |
| D2.ServiceDefaults | ✅ Done | `backends/dotnet/shared/ServiceDefaults/` |
| DistributedCache.Redis | ✅ Done | `backends/dotnet/shared/Implementations/Caching/` (Get, Set, Remove, Exists, GetTtl, Increment) |
| InMemoryCache.Default | ✅ Done | `backends/dotnet/shared/Implementations/Caching/` |
| Transactions.Pg | ✅ Done | `backends/dotnet/shared/Implementations/Repository/` |
| Batch.Pg | ✅ Done | `backends/dotnet/shared/Implementations/Repository/` |
| **RequestEnrichment.Default** | ✅ Done | `backends/dotnet/shared/Implementations/Middleware/` |
| **RateLimit.Default** | ✅ Done | `backends/dotnet/shared/Implementations/Middleware/` (uses abstracted cache handlers) |
| **Geo.Client** | ✅ Done | `backends/dotnet/services/Geo/Geo.Client/` (includes WhoIs cache handler) |

### Shared Packages (Node.js)

> Mirrors .NET shared project structure under `backends/node/shared/`. All packages use `@d2/` scope.
> Workspace root is at project root (`D2-WORX/`) — SvelteKit and other clients can consume any `@d2/*` package.

| Package                  | Status     | Location                                                     | .NET Equivalent              |
|--------------------------|------------|--------------------------------------------------------------|------------------------------|
| **@d2/result**           | 📋 Phase 1 | `backends/node/shared/result/`                                | `D2.Shared.Result`           |
| **@d2/utilities**        | 📋 Phase 1 | `backends/node/shared/utilities/`                             | `D2.Shared.Utilities`        |
| **@d2/handler**          | 📋 Phase 1 | `backends/node/shared/handler/`                               | `D2.Shared.Handler`          |
| **@d2/protos**           | 📋 Phase 1 | `backends/node/shared/protos/`                                | `Protos.DotNet`              |
| **@d2/interfaces**       | 📋 Phase 1 | `backends/node/shared/interfaces/`                            | `D2.Shared.Interfaces`       |
| **@d2/result-extensions** | 📋 Phase 1 | `backends/node/shared/result-extensions/`                     | `D2.Shared.Result.Extensions` |
| **@d2/cache-memory**     | 📋 Phase 1 | `backends/node/shared/implementations/caching/memory/`        | `InMemoryCache.Default`      |
| **@d2/cache-redis**      | 📋 Phase 1 | `backends/node/shared/implementations/caching/redis/`         | `DistributedCache.Redis`     |
| **@d2/geo-cache**        | 📋 Phase 1 | `backends/node/shared/implementations/caching/geo/`           | `Geo.Client` (FindWhoIs)     |
| **@d2/request-enrichment** | 📋 Phase 1 | `backends/node/shared/implementations/middleware/request-enrichment/` | `RequestEnrichment.Default` |
| **@d2/ratelimit**        | 📋 Phase 1 | `backends/node/shared/implementations/middleware/ratelimit/`  | `RateLimit.Default`          |
| **@d2/testing**          | 📋 Phase 1 | `backends/node/shared/testing/`                               | `D2.Shared.Tests` (infra)    |
| **@d2/shared-tests**     | 📋 Phase 1 | `backends/node/shared/tests/`                                 | `D2.Shared.Tests` (tests)    |
| **@d2/service-defaults** | 📋 Phase 2 | `backends/node/shared/service-defaults/`                      | `D2.Shared.ServiceDefaults`  |
| **@d2/auth-client**      | 📋 Phase 2 | TBD                                                          | —                            |
| **@d2/jwt-manager**      | 📋 Phase 2 | TBD                                                          | —                            |

### Services

| Service | Status | Notes |
|---------|--------|-------|
| Geo.Domain | ✅ Done | Entities, value objects |
| Geo.App | ✅ Done | CQRS handlers, mappers |
| Geo.Infra | ✅ Done | Repository, messaging |
| Geo.API | ✅ Done | gRPC service |
| Geo.Client | ✅ Done | Service-owned client library (messages, interfaces, handlers) |
| Geo.Tests | ✅ Done | 591 tests passing |
| **Auth Service** | 📋 Planned | Node.js + Hono + BetterAuth (`backends/node/services/auth/`) |
| **Auth.Tests**   | 📋 Planned | Auth service tests (`backends/node/services/auth-tests/`)    |

### Gateways

| Gateway | Status | Notes |
|---------|--------|-------|
| REST Gateway | ✅ Done | HTTP/REST → gRPC with request enrichment + rate limiting |
| SignalR Gateway | 📋 Planned | WebSocket → gRPC |

### Frontend

| Component | Status | Notes |
|-----------|--------|-------|
| SvelteKit App | 🚧 Scaffold | Basic setup done |
| Auth Integration | 📋 Planned | Proxy to Auth Service |
| OpenTelemetry | ✅ Done | Client + server instrumentation |

---

## Upcoming Work

### Phase 1: TypeScript Shared Infrastructure (Current)

> **Note:** Before building the Auth Service, we need shared TypeScript packages that mirror what already exists on the .NET side. This is the "rebuild in TypeScript" step. Package structure mirrors .NET's TLC folder convention.

**Step 1 — Workspace + Foundation (Layer 0)**
1. **pnpm workspace setup**
   - Workspace root at `D2-WORX/` (like `D2.sln`)
   - `pnpm-workspace.yaml` includes `backends/node/shared/**`, `backends/node/services/*`, `clients/web`
   - Shared `tsconfig.base.json` at `backends/node/`, eslint, prettier
   - Vitest root config with `projects` discovery
2. **@d2/result** — D2Result pattern, error codes (mirrors `D2.Shared.Result`)
3. **@d2/utilities** — String helpers, env loading, serialization (mirrors `D2.Shared.Utilities`)
4. **@d2/protos** — Generated TypeScript proto types + gRPC clients (mirrors `Protos.DotNet`)

**Step 2 — Handler Pattern + Test Infrastructure (Layer 1)**
5. **@d2/handler** — BaseHandler with OTel tracing, structured logging, error handling (mirrors `D2.Shared.Handler`)
6. **@d2/testing** — Shared test infrastructure: custom D2Result matchers, container factories, fixtures (mirrors `D2.Shared.Tests` infra)
7. **@d2/shared-tests** — Tests for all shared packages, validated as each layer is built (mirrors `D2.Shared.Tests`)

**Step 3 — Contracts (Layer 2)**
8. **@d2/interfaces** — Cache operation contracts: Get, Set, Remove, Exists, GetTtl, Increment (mirrors `D2.Shared.Interfaces`)
9. **@d2/result-extensions** — D2Result ↔ Proto conversions (mirrors `D2.Shared.Result.Extensions`)

**Step 4 — Cache Implementations (Layer 3)**
10. **@d2/cache-memory** — In-memory cache handlers (mirrors `InMemoryCache.Default`)
11. **@d2/cache-redis** — Redis cache handlers via ioredis (mirrors `DistributedCache.Redis`)

**Step 5 — Service Client (Layer 4)**
12. **@d2/geo-cache** — LRU memory cache + gRPC fallback to Geo service (mirrors `Geo.Client` FindWhoIs)
    - TTL: 8 hours (configurable), LRU eviction (10,000 entries)

**Step 6 — Middleware (Layer 5)**
13. **@d2/request-enrichment** — IP resolution, fingerprinting, WhoIs lookup middleware for Hono (mirrors `RequestEnrichment.Default`)
14. **@d2/ratelimit** — Multi-dimensional sliding-window rate limiting middleware for Hono (mirrors `RateLimit.Default`)
    - Rate limit alerting scaffold (hook/callback for future notifications service)

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

| Item | Priority | Notes |
|------|----------|-------|
| Test container sharing | Medium | Could speed up integration tests |
| Standardize error codes | Medium | Ensure consistency across services |

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

*Last updated: 2026-02-05*
