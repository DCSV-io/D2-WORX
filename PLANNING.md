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

**Status**: Decided (2025-02)

**Context**: Need authentication across multiple services (SvelteKit, .NET gateways, future Node.js services).

**Decision**:
- **Auth Service**: Standalone Node.js + Hono + BetterAuth (source of truth)
- **SvelteKit**: Proxy pattern (`/api/auth/*` → Auth Service)
- **.NET Gateways**: JWT validation via JWKS endpoint

**Rationale**:
- Single source of truth for auth logic
- SvelteKit retains normal BetterAuth DX (`createAuthClient` works as-is)
- Stateless JWT validation for .NET services (no BetterAuth dependency)
- Horizontal scaling friendly

**Consequences**:
- SvelteKit needs proxy configuration in `hooks.server.ts`
- .NET gateways need JWT validation middleware (MS.IdentityModel.Tokens)
- Auth Service must expose `/api/auth/jwks` endpoint

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

| Package | Status | Location |
|---------|--------|----------|
| **@d2/ratelimit** | 📋 Planned | `contracts/node/ratelimit/` |
| **@d2/geo-cache** | 📋 Planned | `contracts/node/geo-cache/` |
| **@d2/auth-client** | 📋 Planned | Shared BetterAuth client config |

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

### Phase 1: Node.js Foundation (Current)

1. **Create Node.js workspace structure**
   - pnpm workspaces in `backends/node/`
   - Shared tsconfig, eslint, prettier
   - Common D2Result pattern for TypeScript

2. **Create Auth Service**
   - Hono + BetterAuth at `backends/node/services/auth/`
   - PostgreSQL adapter (uses existing d2-auth-db)
   - JWT + Bearer plugins
   - JWKS endpoint for .NET gateway JWT validation

3. **SvelteKit Auth Integration**
   - Proxy configuration in `hooks.server.ts`
   - Session handling
   - `createAuthClient` setup

### Phase 2: Node.js Rate Limiting & Geo Cache

1. **@d2/ratelimit package**
   - Same sliding-window algorithm as .NET RateLimit.Default
   - Redis client (ioredis)
   - Multi-dimensional tracking (fingerprint, IP, city, country)
   - Middleware for Hono/SvelteKit

2. **@d2/geo-cache package**
   - gRPC client to Geo service (using generated protos)
   - LRU memory cache (similar to Geo.Client FindWhoIs)
   - TTL + async refresh

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

## Open Questions

1. **Session storage**: Redis or PostgreSQL for BetterAuth sessions?
   - Redis: Faster, natural TTL
   - PostgreSQL: Simpler (one DB), queryable

2. **Refresh token strategy**: Short-lived access (15m) + long-lived refresh (7d)?

3. **Multi-device sessions**: Allow multiple active sessions per user?

4. **Rate limit alerting**: Threshold for triggering alerts? (e.g., 10 blocks/minute?)

---

## Meeting Notes / Decisions Log

### 2025-02-04

- Removed Keycloak from infrastructure
- Decided on BetterAuth with standalone Auth Service
- Decided on multi-dimensional rate limiting with Redis
- Decided on proxy pattern for SvelteKit ↔ Auth Service
- Created this planning document

---

*Last updated: 2026-02-05*
