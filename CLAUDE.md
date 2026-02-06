# CLAUDE.md — D²-WORX Development Guide

This file provides guidance for Claude Code (and other AI assistants) when working with the D²-WORX codebase.

## Project Overview

**D²-WORX** (Decisive Distributed Application Framework) is a microservices-based evolution of DeCAF, designed for SMB SaaS applications. It combines .NET 10 backend services with a SvelteKit frontend, orchestrated via .NET Aspire.

- **Status:** Pre-Alpha (Core Infrastructure)
- **License:** PolyForm Strict (reference implementation, non-commercial)
- **Language:** C# 14 / .NET 10, TypeScript 5.9, Svelte 5

## Quick Reference

### Commands

> ⚠️ **DO NOT RUN** - Claude Code should not execute `dotnet run`, `pnpm dev`, or any commands that start services. Build and test commands are ONLY acceptable when explicitly requested by the user.

### Key Reference Documents

For deeper architectural context, consult these files:

| Document                                                                                          | Description                        |
|---------------------------------------------------------------------------------------------------|------------------------------------|
| `README.md`                                                                                       | Project overview, setup, status    |
| `backends/BACKENDS.md`                                                                            | Full backend architecture          |
| `backends/dotnet/services/Geo/GEO_SERVICE.md`                                                     | Geo service architecture           |
| `backends/dotnet/services/Geo/Geo.Client/GEO_CLIENT.md`                                           | Geo client library (reference)     |
| `backends/dotnet/shared/Handler/HANDLER.md`                                                       | Handler pattern guide              |
| `backends/dotnet/shared/Result/RESULT.md`                                                         | D2Result pattern                   |
| `backends/dotnet/shared/Implementations/Middleware/RequestEnrichment.Default/REQUEST_ENRICHMENT.md` | Request enrichment middleware    |
| `backends/dotnet/shared/Implementations/Middleware/RateLimit.Default/RATE_LIMIT.md`               | Rate limiting middleware           |
| `CONTRIBUTING.md`                                                                                 | Contribution guidelines            |

---

## Architecture & Patterns

### TLC→2LC→3LC Folder Convention

See `backends/BACKENDS.md` for full details.

**TLC (Top-Level):** Architectural concern → `CQRS`, `Messaging`, `Repository`, `Caching`

**2LC (Second-Level):** Implementation type → `Handlers`, `Entities`, `Migrations`, `MT`

**3LC (Third-Level):** Operation type:
- `C/` - Commands (state-changing) / Create
- `Q/` - Queries (read-only, no side effects)
- `R/` - Repository reads
- `U/` - Updates / Utilities
- `D/` - Deletes
- `X/` - Complex (multistep operations with side effects)
- `Pub/`, `Sub/` - Publish/Subscribe messaging

### CQRS Handler Categories

| Handler Type | Local Cache | Distributed Cache | Database Write | External API |
|--------------|-------------|-------------------|----------------|--------------|
| **Query**    | ✅ OK        | ❌ No              | ❌ No           | ❌ No         |
| **Command**  | ✅ OK        | ✅ OK              | ✅ OK           | ✅ OK         |
| **Complex**  | ✅ OK        | ✅ OK              | ✅ OK           | ✅ OK         |

**Key Distinction:** If the process dies immediately after the handler completes, would any state change persist or be visible to other instances? For Queries, the answer must be "no."

- **Query**: Read-only from the perspective of persistent/shared state. Local/in-memory caching is permitted as an invisible optimization.
- **Command**: Primary intent is mutation of persistent/shared state. Caller expects durable changes.
- **Complex**: Primary intent is retrieval, but may mutate persistent/shared state as a side effect (e.g., fetching from external source then persisting).

### Verb Semantics

| Verb     | Semantics                                                     | Side Effects      |
|----------|---------------------------------------------------------------|-------------------|
| **Find** | "Resolve this for me" — may fetch from external source, cache | May create/upsert |
| **Get**  | "Give me this by ID" — direct lookup                          | Read-only         |

Example: `FindWhoIs` (by IP+fingerprint, may hydrate from API) vs `GetWhoIsByIds` (by hash, direct lookup)

### Handler Pattern

Handlers use `BaseHandler<TSelf, TInput, TOutput>` with automatic logging, tracing, and error handling.

**IHandlerContext** bundles `IRequestContext` (trace IDs, user info) and `ILogger` to reduce constructor boilerplate.

```csharp
using H = ICommands.ISetInMemHandler;
using I = ICommands.SetInMemInput;
using O = ICommands.SetInMemOutput;

public class SetInMem : BaseHandler<SetInMem, I, O>, H
{
    private readonly IMemoryCache r_memoryCache;

    public SetInMem(IMemoryCache memoryCache, IHandlerContext context)
        : base(context)
    {
        r_memoryCache = memoryCache;
    }

    protected override ValueTask<D2Result<O?>> ExecuteAsync(
        I input, CancellationToken ct = default)
    {
        // Implementation - use TraceId property for logging
        return ValueTask.FromResult(D2Result<O?>.Ok(new O(), traceId: TraceId));
    }
}
```

### D2Result Pattern

Use result objects instead of exceptions for control flow:

```csharp
// Success
D2Result.Ok()
D2Result<TData>.Ok(data, traceId: TraceId)

// Failures
D2Result.Fail(messages, statusCode, errorCode, traceId: TraceId)
D2Result.ValidationFailed(inputErrors, traceId: TraceId)
D2Result.NotFound(traceId: TraceId)
D2Result.SomeFound(data, traceId: TraceId)  // Partial success
D2Result.Unauthorized(traceId: TraceId)

// Checking and propagating
if (result.CheckSuccess(out var output)) { /* use output */ }
if (result.CheckFailure(out var output)) { /* handle error, output may have partial data */ }
return D2Result<TNewData>.BubbleFail(result);  // Propagate errors with type change
```

**Partial Success Pattern:**
- `NOT_FOUND` - None of the requested items were found
- `SOME_FOUND` - Some items found, but not all (data still returned)
- `OK` - All items found

### Content-Addressable Entities

`Location` and `WhoIs` entities use SHA-256 content-addressable hash IDs:
- Hash is computed from immutable identity properties
- Stored as 64-character hex string (32 bytes)
- Enables automatic deduplication and idempotent operations
- Hash computed via factory methods: `Location.Create(...)`, `WhoIs.Create(...)`

```csharp
// Location hash: coordinates + address + city + postal + subdivision + country
var location = Location.Create(
    coordinates: Coordinates.Create(34.0522, -118.2437),
    address: StreetAddress.Create("123 Main St"),
    city: "Los Angeles",
    postalCode: "90001",
    subdivisionISO31662Code: "US-CA",
    countryISO31661Alpha2Code: "US");
// location.HashId is now a 64-char hex string

// WhoIs hash: IP + year + month + fingerprint (for temporal versioning)
var whoIs = WhoIs.Create("192.168.1.1", year: 2025, month: 6, fingerprint: "Mozilla/5.0...");
```

### Mappers

Mappers live in `ServiceName.App/Mappers/` and use extension member syntax:

```csharp
public static class LocationMapper
{
    extension(Location location)
    {
        public LocationDTO ToDTO() { ... }
    }

    extension(LocationDTO locationDTO)
    {
        public Location ToDomain() { ... }
    }

    extension(LocationToCreateDTO locationToCreateDTO)
    {
        public Location ToDomain() { ... }
    }
}
```

**Usage:**
```csharp
var dto = location.ToDTO();
var domain = dto.ToDomain();
```

### Multi-Tier Caching

Cache retrieval order: **Memory → Redis → Database → Disk**

Cache population: When data is retrieved from a lower tier, populate all higher tiers.

**Cache Key Convention:** `EntityName:{id}` (e.g., `Location:abc123...`)

### Batch Operations

Repository handlers use batched queries to avoid large IN clause issues:

```csharp
private const int _BATCH_SIZE = 500;  // Or from options

foreach (var batch in input.HashIds.Chunk(_BATCH_SIZE))
{
    var results = await r_db.Locations
        .AsNoTracking()
        .Where(l => batch.Contains(l.HashId))
        .ToListAsync(ct);
    // ...
}
```

### Options Pattern

Configuration uses the Options pattern with sensible defaults:

```csharp
// In ServiceName.App/Options/
public class GeoAppOptions
{
    public TimeSpan LocationCacheExpiration { get; set; } = TimeSpan.FromHours(1);
    public TimeSpan WhoIsCacheExpiration { get; set; } = TimeSpan.FromHours(1);
    public TimeSpan ContactCacheExpiration { get; set; } = TimeSpan.FromHours(1);
}

// In ServiceName.Infra/Options/
public class GeoInfraOptions
{
    public int BatchSize { get; set; } = 500;
}

// Registration (sections are optional - defaults apply if missing)
services.Configure<GeoAppOptions>(config.GetSection(nameof(GeoAppOptions)));
```

### Partial Interface Extension Pattern

Interfaces are **partial** and split across files by operation:

```csharp
// ICommands.cs - base partial interface
public partial interface ICommands { }

// ICommands.SetInMem.cs - extends with specific handler
public partial interface ICommands
{
    public interface ISetInMemHandler : IHandler<SetInMemInput, SetInMemOutput>;
    public record SetInMemInput(GetReferenceDataResponse Data);
    public record SetInMemOutput;
}
```

### C# 14 Extension Members

This project uses C# 14 extension member syntax (not the older `this` parameter style):

```csharp
public static class Extensions
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddMyService(IConfiguration config)
        {
            services.Configure<MyOptions>(config.GetSection(nameof(MyOptions)));
            services.AddTransient<IMyHandler, MyHandler>();
            return services;
        }
    }
}
```

---

## Project Structure

```
D2-WORX/
├── pnpm-workspace.yaml              # TS workspace root (like D2.sln for .NET)
├── package.json                      # Root scripts, shared devDeps
├── contracts/
│   └── protos/                       # Tech-agnostic Protocol Buffers
│       ├── common/v1/                # Common types (D2Result, etc.)
│       ├── auth/v1/                  # Auth service protos
│       └── geo/v1/                   # Geo service protos
├── backends/
│   ├── dotnet/                       # .NET backends
│   │   ├── orchestration/
│   │   │   └── AppHost/              # Aspire orchestration
│   │   ├── shared/                   # Shared libraries
│   │   │   ├── Handler/              # BaseHandler pattern
│   │   │   ├── Interfaces/           # Contract interfaces (TLC hierarchy)
│   │   │   ├── Implementations/      # Reusable implementations (Caching, Repository)
│   │   │   ├── Result/               # D2Result pattern
│   │   │   ├── Result.Extensions/    # D2Result ↔ Proto conversions
│   │   │   ├── ServiceDefaults/      # OpenTelemetry config
│   │   │   ├── Tests/                # Shared test infrastructure
│   │   │   ├── Utilities/            # Extensions & helpers
│   │   │   └── protos/               # Generated C# protos
│   │   ├── gateways/
│   │   │   └── REST/                 # HTTP/REST → gRPC gateway
│   │   └── services/
│   │       └── Geo/                  # Geographic service
│   │           ├── Geo.Client/       # Service-owned client library
│   │           ├── Geo.Domain/       # DDD entities & value objects
│   │           ├── Geo.App/          # CQRS handlers, mappers
│   │           ├── Geo.Infra/        # Repository, messaging, EF Core
│   │           ├── Geo.API/          # gRPC service
│   │           └── Geo.Tests/        # Tests
│   ├── node/                         # Node.js backends
│   │   ├── tsconfig.base.json        # Shared TypeScript config
│   │   ├── shared/                   # Shared TS packages (mirrors dotnet/shared/)
│   │   │   ├── result/               # @d2/result
│   │   │   ├── utilities/            # @d2/utilities
│   │   │   ├── handler/              # @d2/handler (BaseHandler + OTel)
│   │   │   ├── interfaces/           # @d2/interfaces (cache contracts)
│   │   │   ├── result-extensions/    # @d2/result-extensions
│   │   │   ├── protos/               # @d2/protos (generated TS)
│   │   │   └── implementations/      # Mirrors dotnet Implementations/
│   │   │       ├── caching/
│   │   │       │   ├── memory/       # @d2/cache-memory
│   │   │       │   ├── redis/        # @d2/cache-redis
│   │   │       │   └── geo/          # @d2/geo-cache
│   │   │       └── middleware/
│   │   │           ├── request-enrichment/  # @d2/request-enrichment
│   │   │           └── ratelimit/    # @d2/ratelimit
│   │   ├── testing/                  # @d2/testing (shared test infra)
│   │   └── tests/                    # @d2/shared-tests (tests all shared pkgs)
│   │       ├── vitest.config.ts
│   │       ├── unit/
│   │       └── integration/
│   │
│   └── services/
│       ├── auth/                     # Auth service (BetterAuth)
│       └── auth-tests/               # Auth service tests
│   └── go/                           # Go backends
│       ├── shared/                   # Shared Go packages
│       └── services/
│           └── media/                # Media/file processing
├── clients/
│   ├── web/                          # SvelteKit 5 app (consumes @d2/* packages)
│   └── mobile/                       # React Native / Expo
├── tools/
│   └── proto-gen/                    # Proto generation scripts
├── observability/                    # LGTM stack configs
└── D2.sln                            # .NET Solution file
```

---

## Code Conventions

### C# Style

**File Headers (required on all .cs files):**
```csharp
// -----------------------------------------------------------------------
// <copyright file="FileName.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------
```

**XML Documentation (required for public APIs):**
```csharp
/// <summary>
/// Gets the ISO 3166-1 alpha-2 code of the country.
/// </summary>
/// <example>US.</example>
/// <remarks>Must be unique. Always a 2-char string.</remarks>
public required string ISO31661Alpha2Code { get; init; }
```

**Naming Conventions:**

| Element                              | Convention         | Example                    |
|--------------------------------------|--------------------|----------------------------|
| Classes/Records/Interfaces           | `PascalCase`       | `GetReferenceData`         |
| Methods/Properties                   | `PascalCase`       | `HandleAsync`              |
| Private instance fields              | `_camelCase`       | `_memoryCache`             |
| Private readonly instance fields     | `r_camelCase`      | `r_getFromMem`             |
| Private static fields                | `s_camelCase`      | `s_instance`               |
| Private static readonly fields       | `sr_camelCase`     | `sr_activitySource`        |
| Static readonly fields (non-private) | `SR_PascalCase`    | `SR_ActivitySource`        |
| Private constants                    | `_UPPER_CASE`      | `_BATCH_SIZE`              |
| Public/Internal constants            | `UPPER_CASE`       | `MAX_ATTEMPTS`             |
| Local constants (in tests)           | `snake_case`       | `expected_count`           |
| Local variables                      | `camelCase`        | `result`                   |

**Entity Design:**
- Use `record` types for immutability
- Use `required init` for mandatory properties
- Initialize collections as empty: `ICollection<T> { }` or `[]`
- Content-addressable entities compute hash in factory method

**Database Conventions:**
- Column names: `snake_case` (configured via EF Core)
- Explicit schema control via entity type configurations
- Primary keys are automatically indexed by PostgreSQL

### TypeScript/Frontend Style

See `SvelteKit_and_TypeScript_Conventions_for_Enterprise_Applications.md` for details.

- Strict TypeScript enabled
- ESLint + Prettier enforced
- Tailwind CSS v4.1 for styling
- PascalCase for components, kebab-case for modules
- Result patterns for error handling

---

## Documentation

### Markdown Files

Every project/module should have a corresponding `.md` file documenting its purpose and contents:

- `ProjectName/PROJECT_NAME.md` - e.g., `Batch.Pg/BATCH_PG.md`, `Geo.App/GEO_APP.md`
- Update documentation as part of completing a feature iteration, not as an afterthought
- Documentation is part of the "definition of done" for any feature work

### Table Formatting

Format markdown tables for **plain-text readability** with aligned columns:

```markdown
<!-- Good: Columns aligned, readable in any editor -->
| File Name                | Description                                      |
|--------------------------|--------------------------------------------------|
| [Get.cs](Handlers/R/Get.cs) | Handler for retrieving data from cache.       |
| [Set.cs](Handlers/U/Set.cs) | Handler for storing data with optional TTL.   |

<!-- Bad: Columns not aligned, hard to read in plain text -->
| File Name | Description |
|---|---|
| [Get.cs](Handlers/R/Get.cs) | Handler for retrieving data from cache. |
```

### When to Update Documentation

Update `.md` files when:
- Adding new handlers, mappers, or entities
- Adding new projects or modules (create new `.md`)
- Changing public APIs or interfaces
- Adding new configuration options
- Completing a feature iteration (review all affected `.md` files)

---

## Testing

### .NET Backend Tests

**Frameworks:** xUnit, FluentAssertions, Moq, Testcontainers

**Structure:**
```
Service.Tests/
├── Unit/
│   ├── Domain/Entities/
│   └── Infra/Messaging/
└── Integration/
    ├── App/
    └── Infra/Repository/
```

**Test Naming:** Descriptive names that explain the scenario, e.g.:
- `GetHandler_WhenMemoryCacheHit_ReturnsDataWithoutCallingRedis`
- `Create_WithValidCoordinates_GeneratesConsistentHashId`

**Hash ID Assertions (content-addressable entities):**
```csharp
// 32 bytes = 64 hex characters
location.HashId.Should().HaveLength(64);

// Same input = same hash
location1.HashId.Should().Be(location2.HashId);

// Different input = different hash
location1.HashId.Should().NotBe(location3.HashId);
```

**Integration Tests with Testcontainers:**
```csharp
[MustDisposeResource(false)]
public class MyTests : IAsyncLifetime
{
    private PostgreSqlContainer _container = null!;
    protected CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:18")
            .Build();
        await _container.StartAsync(Ct);
    }

    public async ValueTask DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}
```

### TypeScript Backend Tests

**Frameworks:** Vitest 4.x, Testcontainers (PostgreSQL + Redis modules)

**Key principle:** Test projects are **separate** from source packages (mirrors .NET). Source packages have zero test dependencies — all test deps live in dedicated test projects.

| Package              | Purpose                                     | .NET Equivalent                |
|----------------------|---------------------------------------------|--------------------------------|
| `@d2/testing`        | Shared test infra (matchers, containers)    | `D2.Shared.Tests` (infra)     |
| `@d2/shared-tests`   | Tests for all shared packages               | `D2.Shared.Tests` (tests)     |
| `auth-tests`         | Tests for Auth service                      | `Geo.Tests` (pattern)         |

**Structure:**
```
backends/node/shared/
  testing/                    # @d2/testing — shared test helpers
    src/
      matchers/               # Custom expect matchers (toBeSuccess, toBeFailure)
      containers/             # Container factory functions (Postgres, Redis)
      fixtures/               # Shared test fixtures
  tests/                      # @d2/shared-tests — tests for all shared packages
    vitest.config.ts
    unit/
      result/
      handler/
      cache-memory/
    integration/
      cache-redis/
      geo-cache/
      ratelimit/

backends/node/services/
  auth-tests/                 # Auth service tests
    vitest.config.ts
    unit/
    integration/
```

**Test stack mapping:**

| Concern           | .NET                        | TypeScript                               |
|-------------------|-----------------------------|------------------------------------------|
| Test runner       | xUnit                       | Vitest 4.x                               |
| Assertions        | FluentAssertions            | Vitest `expect` + custom D2Result matchers |
| Mocking           | Moq                         | `vi.mock`, `vi.fn`, `vi.spyOn`           |
| Coverage          | —                           | `@vitest/coverage-v8`                    |
| Containers (PG)   | `Testcontainers.PostgreSql` | `@testcontainers/postgresql`             |
| Containers (Redis) | `Testcontainers.Redis`      | `@testcontainers/redis`                  |

**Vitest monorepo setup:**
- Root `vitest.config.ts` with `projects` discovery (auto-finds all test configs)
- Shared `vitest.shared.ts` at `backends/node/` inherited by all test projects
- Run from root: `pnpm vitest` (all) or `pnpm vitest --project shared-tests` (specific)
- Coverage aggregated across all packages via `@vitest/coverage-v8`

**Prefer dependency injection over module mocking** — design services to accept deps via constructor/factory (mirrors .NET handler pattern with `IHandlerContext`). Use `vi.mock` only for infrastructure boundaries.

---

## Git Conventions

### Branch Naming
- `feat/...` - New features
- `fix/...` - Bug fixes
- `docs/...` - Documentation
- `refactor/...` - Code cleanup
- `test/...` - Test additions
- `infra/...` - CI/CD, deployment

### Commit Messages (Conventional Commits)

```
feat: add CQRS handler for get operation
fix: correct cache expiration logic
test: add integration tests for repository
docs: update handler pattern documentation
chore: bump dependency versions
refactor: simplify caching logic
```

**With scope:** `feat(geo): add primary locales`

**Important:** Do NOT add `Co-Authored-By` lines to commit messages.

---

## Infrastructure

### Services (via Aspire)

| Service         | Version | Purpose                    |
|-----------------|---------|----------------------------|
| PostgreSQL      | 18      | Per-service databases      |
| Redis           | 8.2     | Distributed cache          |
| RabbitMQ        | 4.1     | Async messaging            |
| MinIO           | Latest  | Object storage (S3)        |
| LGTM Stack      | Various | Observability              |

### Communication Patterns

- **Sync:** gRPC between services (HTTP/2)
- **Async:** RabbitMQ events via MassTransit
- **Caching:** Memory → Redis → Database → Disk (fallback)

---

## Notes for Claude

### Behavioral Guidelines

- **ALWAYS ask questions when uncertain** - This is the #1 rule. If you are not sure about something — requirements, approach, tradeoffs, conventions — **ask**. Do not guess. Do not assume. Do not "pick the most likely option." Ask. Every time.
- **Read freely** - explore any files needed to understand context
- **Ask before changing** - do not modify files without explicit user approval
- **Avoid assumptions** - if requirements are unclear, ask for clarification
- **Provide options** - when multiple approaches exist, present them for user decision
- **Research first** - check related files (tests, interfaces, existing implementations) before proposing changes
- **Think it through** - explain reasoning and tradeoffs rather than jumping to implementation

### Key Principles

- This is a **reference implementation** showing DeCAF → D² evolution
- Emphasizes **strong DX**: minimal boilerplate, clear patterns, automatic instrumentation
- All major patterns are established; **follow existing conventions**
- Currently, in Pre-Alpha: **Geo service is the primary implementation reference**

### Before Writing Code

1. **Check existing implementations** - look for similar handlers/patterns in the codebase
2. **Read relevant documentation** - `*.md` files are authoritative references
3. **Use existing utilities** - check `D2.Contracts.Utilities` before creating helpers
4. **Follow naming conventions** - especially the field prefixes (`r_`, `s_`, `sr_`, `_`)

### Common Mistakes to Avoid

- Don't use `this` parameter style for extension methods (use C# 14 `extension` syntax)
- Don't throw exceptions for control flow (use `D2Result`)
- Don't forget license headers on new files
- Don't create new patterns when existing ones apply
- Don't use `_camelCase` for readonly fields (use `r_camelCase`)
- Don't forget to implement the interface when creating generic handlers for DI
- Don't hardcode batch sizes or cache expirations (use Options pattern)
- Don't forget to update/create `.md` documentation when adding features (see Documentation section)

### Current Development Focus

**Completed (.NET):**
- Geo service: Full domain, app, infra, and API layers with 591+ tests
- Geo.Client: Service-owned client library with WhoIs cache handler (`FindWhoIs`)
- REST Gateway: HTTP/REST → gRPC routing with request enrichment + rate limiting
- RequestEnrichment.Default: IP resolution, fingerprinting, WhoIs lookup middleware
- RateLimit.Default: Multi-dimensional sliding-window rate limiting middleware
- Distributed cache abstractions: GetTtl, Increment handlers (abstracted from Redis)
- All shared implementations use project-defined abstractions (no direct Redis/MS cache)

**Next (Node.js/TypeScript) — in order:**

Phase 1 (TS shared infra — must come BEFORE auth):
1. Node.js workspace setup (pnpm workspaces in `backends/node/`)
2. `@d2/core` package (D2Result pattern, shared types)
3. `@d2/ratelimit` package (same sliding-window algorithm as .NET)
4. `@d2/geo-cache` package (local WhoIs cache with gRPC fallback)

Phase 2 (Auth):
5. Auth Service (Node.js + Hono + BetterAuth) at `backends/node/services/auth/`
6. SvelteKit auth integration (proxy pattern, session hooks, JWT manager)
7. .NET Gateway JWT validation (`AddJwtBearer` + JWKS)

### When in Doubt

- Check similar existing implementations in codebase
- Reference the `*.md` documentation files
- Follow the patterns established in `Geo.App` and `Geo.Infra`
- Ask for clarification rather than guessing

---

## Architecture Decisions (2025-02, updated 2026-02-05)

See `PLANNING.md` for detailed ADRs (including ADR-005: Request Flow Pattern) and status tracking.

### Authentication Architecture

- **Auth Service**: Standalone Node.js + Hono + BetterAuth at `backends/node/services/auth/`
- **SvelteKit**: Uses proxy pattern (`/api/auth/*` → Auth Service). `createAuthClient` works normally.
- **.NET Gateways**: Validate JWTs via JWKS endpoint (no BetterAuth dependency)
- **Keycloak**: REMOVED - do not reference or use

#### Session Management (3-Tier)

BetterAuth is session-based at its core (not JWT-based). Sessions use 3-tier storage:

| Tier              | Storage    | Lookup Cost | Revocation Lag            |
|-------------------|------------|-------------|---------------------------|
| Cookie cache      | In cookie  | Zero        | Up to 5min (maxAge)       |
| Secondary storage | Redis      | ~1ms        | Instant                   |
| Primary DB        | PostgreSQL | ~5-10ms     | Instant                   |

- `expiresIn`: 7 days, `updateAge`: 1 day, `cookieCache.maxAge`: 5 minutes
- `storeSessionInDatabase: true` — dual-write for audit trail + durability
- Session revocation is OOTB: `revokeSession`, `revokeOtherSessions`, `revokeSessions`, `listSessions`
- Individual session revocation supported (including server-side API for non-current sessions)

#### JWT (for service-to-service / .NET gateway)

- **Algorithm**: RS256 (native .NET support — do NOT use EdDSA, it requires extra packages)
- **Expiration**: 15 minutes
- **JWKS endpoint**: `/api/auth/jwks`
- **Key rotation**: 30 days, 30-day grace period
- **BetterAuth plugins**: `bearer` (session token via header) + `jwt` (RS256 tokens for external services)
- **Important**: Bearer plugin token ≠ JWT. Bearer uses the session token (validated via DB/Redis). JWT plugin issues signed tokens (validated via JWKS public key).

#### Request Flow (Hybrid Pattern C)

Two paths coexist — SSR through SvelteKit, interactive calls direct to gateway:

```
SSR / slow-changing data:
  Browser ──cookie──► SvelteKit Server ──JWT──► .NET Gateway ──gRPC──► Services

Interactive client-side (search, forms, real-time):
  Browser ──JWT──► .NET Gateway ──gRPC──► Services

Auth (always proxied, cookie-based):
  Browser ──cookie──► SvelteKit ──proxy──► Auth Service
```

- SvelteKit server obtains/caches JWTs for server-side calls to the gateway
- Client obtains JWTs via `authClient.token()` (proxied through SvelteKit to Auth Service)
- Client stores JWT **in memory only** (never localStorage — XSS risk), auto-refreshes before 15min expiry
- .NET gateway must be publicly accessible with CORS configured for SvelteKit origin

#### Horizontal Scaling

No sticky sessions required. Any instance can handle any request:
- Cookie cache: session data travels with the request
- Redis: shared session store any instance can query
- JWTs: self-contained, any instance validates with cached JWKS public key
- Spinning up new instances/locations: just point at shared Redis + PG

### Rate Limiting

- **Packages**: `@d2/ratelimit` (Node.js - planned), `RateLimit.Default` (C# - done)
- **Storage**: Redis via abstracted distributed cache handlers (GetTtl, Increment, Set)
- **Dimensions**: ClientFingerprint (100/min), IP (5,000/min), City (25,000/min), Country (100,000/min)
- **Algorithm**: Sliding window approximation (two fixed-window counters + weighted average)
- **Logic**: If ANY dimension exceeds threshold → block for 5 minutes
- **Country whitelist**: US, CA, GB exempt from country-level blocking
- **Fail-open**: If Redis down or WhoIs unavailable, requests pass through

### Request Enrichment

- **Package**: `RequestEnrichment.Default` (C# - done)
- Resolves client IP from CF-Connecting-IP → X-Real-IP → X-Forwarded-For → RemoteIp
- Computes server fingerprint (SHA-256 of UA + Accept headers) for logging
- Reads client fingerprint from `X-Client-Fingerprint` header for rate limiting
- Calls Geo.Client WhoIs cache for city/country/VPN flags
- Sets `IRequestInfo` on `HttpContext.Features` for downstream middleware

### Geo Caching

- **Packages**: `@d2/geo-cache` (Node.js - planned), Geo.Client `FindWhoIs` handler (C# - done)
- Local memory cache for WhoIs data to avoid Geo service bombardment
- TTL: 8 hours (configurable via `GeoClientOptions`), LRU eviction (10,000 entries)

---

## Node.js / TypeScript Conventions

### Workspace Structure

```
D2-WORX/                              # pnpm workspace root
├── pnpm-workspace.yaml                # packages: backends/node/shared/**, backends/node/services/*, clients/web
├── package.json                        # Root scripts, shared devDeps
├── vitest.config.ts                    # Root Vitest config (projects discovery)
│
backends/node/
├── tsconfig.base.json                  # Shared TS config (strict, paths, etc.)
├── vitest.shared.ts                    # Shared Vitest config (inherited by test projects)
├── shared/                             # Mirrors dotnet/shared/ — all @d2/* packages
│   ├── result/                         # @d2/result (Layer 0)
│   ├── utilities/                      # @d2/utilities (Layer 0)
│   ├── handler/                        # @d2/handler (Layer 1) — BaseHandler + OTel
│   ├── interfaces/                     # @d2/interfaces (Layer 2) — cache contracts
│   ├── result-extensions/              # @d2/result-extensions (Layer 2)
│   ├── protos/                         # @d2/protos (Layer 0) — generated TS
│   ├── implementations/
│   │   ├── caching/
│   │   │   ├── memory/                 # @d2/cache-memory (Layer 3)
│   │   │   ├── redis/                  # @d2/cache-redis (Layer 3)
│   │   │   └── geo/                    # @d2/geo-cache (Layer 4)
│   │   └── middleware/
│   │       ├── request-enrichment/     # @d2/request-enrichment (Layer 5)
│   │       └── ratelimit/             # @d2/ratelimit (Layer 5)
│   ├── testing/                        # @d2/testing — shared test infra (matchers, containers)
│   └── tests/                          # @d2/shared-tests — tests all shared packages
│       ├── vitest.config.ts
│       ├── unit/
│       └── integration/
└── services/
    ├── auth/                           # Auth service (Hono + BetterAuth)
    │   ├── package.json
    │   ├── src/
    │   │   ├── index.ts                # Hono app entry
    │   │   ├── auth.ts                 # BetterAuth config
    │   │   └── routes/
    │   └── Dockerfile
    └── auth-tests/                     # Auth service tests
        ├── vitest.config.ts
        ├── unit/
        └── integration/
```

### Package Dependency Graph

```
Layer 0 (no project deps):  @d2/result, @d2/utilities, @d2/protos
Layer 1:  @d2/handler        → result
Layer 2:  @d2/interfaces     → handler, protos, utilities
          @d2/result-ext     → result, protos
Layer 3:  @d2/cache-memory   → handler, interfaces
          @d2/cache-redis    → interfaces, utilities
Layer 4:  @d2/geo-cache      → handler, cache-memory, interfaces, result-ext, utilities
Layer 5:  @d2/request-enrich → handler, geo-cache
          @d2/ratelimit      → request-enrich, handler, result, interfaces
```

### Design Principles

- **Mirror .NET structure** — 1:1 package boundaries with .NET shared projects
- **Handler pattern everywhere** — BaseHandler with OTel tracing on all backend operations
- **Abstractions over implementations** — Rate limiter uses cache interfaces, not Redis directly
- **DDD on backends** — Domain-driven design with proper abstractions, even in TypeScript
- **Lighter touch on clients** — Frontend/client code can be more pragmatic
- **Locked dependencies** — All npm package versions pinned exactly (supply chain security)
- **Each package builds independently** — `tsc` compiles to `dist/`, consumers reference compiled output (like `dotnet build`)

### Build Tooling

- **Library packages** (`@d2/*`): Plain `tsc` — each package has its own `tsconfig.json` extending `backends/node/tsconfig.base.json`, compiles to `dist/` with `.js` + `.d.ts` output
- **Service apps** (auth, etc.): TBD in Phase 2 (likely `tsup` or `tsx`)
- **Module format**: ESM only (`"type": "module"` in all `package.json` files)
- **Package exports**: Each `package.json` uses `exports` field pointing to `dist/`

```jsonc
// Example @d2/result package.json
{
  "name": "@d2/result",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  }
}
```

### Dependency Security

**All npm/pnpm dependency versions MUST be exact** — no `^`, no `~`, no ranges. This is a supply chain security requirement.

```jsonc
// GOOD — exact versions, locked down
"vitest": "4.0.18",
"ioredis": "5.6.1",
"hono": "4.7.12"

// BAD — version ranges, vulnerable to supply chain attacks
"vitest": "^4.0.0",
"ioredis": "~5.6.0",
"hono": ">=4.0.0"
```

**Enforcement via `.npmrc` at project root:**
```ini
engine-strict=true
save-exact=true
save-prefix=
prefer-frozen-lockfile=true
strict-peer-dependencies=true
```

- `save-exact=true` + `save-prefix=` — `pnpm add` always pins exact versions, no `^` or `~`
- `prefer-frozen-lockfile=true` — CI/production installs fail if lockfile is out of date
- `strict-peer-dependencies=true` — fail on peer dep mismatches instead of silently resolving
- `engine-strict=true` — enforce Node.js version requirements from `package.json`
- `pnpm-lock.yaml` is always committed and never deleted
- Audit regularly: `pnpm audit` to check for known vulnerabilities
- Update deliberately: pin to specific versions, update one at a time, test after each update

### TypeScript Style

- **Strict mode**: Always enabled
- **Naming**: camelCase for variables/functions, PascalCase for types/classes/interfaces
- **Imports**: Use `type` imports for type-only imports
- **Error handling**: Use `@d2/result` (D2Result pattern) — same semantics as .NET

### Package Naming

- Internal packages: `@d2/{package-name}`
- pnpm workspaces from project root (`D2-WORX/`)
- All shared packages under `backends/node/shared/`
- Any TS client (SvelteKit, React Native) can reference `@d2/*` packages

---

## Critical Reminders for Claude

1. **ALWAYS ask when uncertain** - Do not guess. Do not assume. Ask questions. This is non-negotiable.

2. **No Keycloak** - It has been removed. Auth uses BetterAuth.

3. **Check PLANNING.md** - For current sprint focus, status, and resolved decisions.

4. **JWT = RS256** - Use `Microsoft.IdentityModel.Tokens` with JWKS from Auth Service. Do NOT use EdDSA.

5. **SvelteKit auth** - Uses proxy pattern, NOT direct BetterAuth integration. Cookie-based sessions, not JWTs, for browser ↔ SvelteKit.

6. **Request flow is hybrid (Pattern C)** - SSR via SvelteKit server, interactive client-side calls go direct to .NET gateway with JWT. Auth always proxied through SvelteKit.

7. **Rate limiting is multi-dimensional** - IP + userId + fingerprint + city + country. All dimensions tracked, any exceeds = block all.

8. **Geo caching packages** - Create local cache wrappers to avoid bombarding Geo service with WhoIs lookups.

9. **Phase ordering** - TypeScript shared infrastructure (`@d2/core`, `@d2/ratelimit`, `@d2/geo-cache`) must be built BEFORE the Auth Service.

10. **Session storage is 3-tier** - Cookie cache (5min) → Redis (secondary) → PostgreSQL (primary). `storeSessionInDatabase: true` for dual-write.

11. **Exact dependency versions only** - No `^`, no `~`, no ranges in `package.json`. Use `save-exact=true` in `.npmrc`. This is a supply chain security requirement.
