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

| Document                                              | Description                        |
|-------------------------------------------------------|------------------------------------|
| `README.md`                                           | Project overview, setup, status    |
| `backends/BACKENDS.md`                                | Full backend architecture          |
| `backends/dotnet/services/Geo/GEO_SERVICE.md`         | Geo service architecture           |
| `backends/dotnet/services/Geo/Geo.Client/GEO_CLIENT.md` | Geo client library (reference)  |
| `backends/dotnet/shared/Handler/HANDLER.md`           | Handler pattern guide              |
| `backends/dotnet/shared/Result/RESULT.md`             | D2Result pattern                   |
| `CONTRIBUTING.md`                                     | Contribution guidelines            |

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
├── contracts/
│   └── protos/                     # Tech-agnostic Protocol Buffers
│       ├── common/v1/              # Common types (D2Result, etc.)
│       ├── auth/v1/                # Auth service protos
│       └── geo/v1/                 # Geo service protos
├── backends/
│   ├── dotnet/                     # .NET backends
│   │   ├── orchestration/
│   │   │   └── AppHost/            # Aspire orchestration
│   │   ├── shared/                 # Shared libraries
│   │   │   ├── Handler/            # BaseHandler pattern
│   │   │   ├── Interfaces/         # Contract interfaces (TLC hierarchy)
│   │   │   ├── Implementations/    # Reusable implementations (Caching, Repository)
│   │   │   ├── Result/             # D2Result pattern
│   │   │   ├── Result.Extensions/  # D2Result ↔ Proto conversions
│   │   │   ├── ServiceDefaults/    # OpenTelemetry config
│   │   │   ├── Tests/              # Shared test infrastructure
│   │   │   ├── Utilities/          # Extensions & helpers
│   │   │   └── protos/             # Generated C# protos
│   │   ├── gateways/
│   │   │   └── REST/               # HTTP/REST → gRPC gateway
│   │   └── services/
│   │       └── Geo/                # Geographic service
│   │           ├── Geo.Client/     # Service-owned client library
│   │           ├── Geo.Domain/     # DDD entities & value objects
│   │           ├── Geo.App/        # CQRS handlers, mappers
│   │           ├── Geo.Infra/      # Repository, messaging, EF Core
│   │           ├── Geo.API/        # gRPC service
│   │           └── Geo.Tests/      # Tests
│   ├── node/                       # Node.js backends
│   │   ├── shared/                 # @d2/core, @d2/protos
│   │   └── services/
│   │       └── auth/               # Auth service (BetterAuth)
│   └── go/                         # Go backends
│       ├── shared/                 # Shared Go packages
│       └── services/
│           └── media/              # Media/file processing
├── clients/
│   ├── web/                        # SvelteKit 5 app
│   └── mobile/                     # React Native / Expo
├── tools/
│   └── proto-gen/                  # Proto generation scripts
├── observability/                  # LGTM stack configs
└── D2.sln                          # .NET Solution file
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

### Backend Tests

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

### Current Development Focus (Geo Service)

**Completed:**
- Domain entities: Location, WhoIs, Contact with content-addressable hash IDs
- Value objects: Coordinates, StreetAddress, EmailAddress, PhoneNumber, Personal, Professional, ContactMethods
- Mappers: All domain ↔ DTO conversions (with unit tests)
- CQRS interfaces: Queries, Commands, Complex handlers
- Repository interfaces: Read, Create, Delete handlers
- In-memory cache handlers: Get, Set, GetMany, SetMany
- App layer: Full CQRS handlers for Location, WhoIs, Contact (get, create, delete, find)
- Infra layer: Repository handlers for all entities + WhoIs external API integration
- EF Core configurations: Location, WhoIs, Contact entities
- Batch.Pg: Reusable batched query utilities with D2Result integration
- Geo.Client: Service-owned client library (messages, interfaces, default handlers)
- Integration tests: 591 tests covering all handlers, repository, messaging, client library

**Next:**
- Node.js/TypeScript Geo client library
- Auth Service (Node.js + Hono + BetterAuth)
- Rate limiting packages (@d2/ratelimit, D2.RateLimit.Redis)

### When in Doubt

- Check similar existing implementations in codebase
- Reference the `*.md` documentation files
- Follow the patterns established in `Geo.App` and `Geo.Infra`
- Ask for clarification rather than guessing

---

## Architecture Decisions (2025-02)

See `PLANNING.md` for detailed ADRs and status tracking.

### Authentication Architecture

- **Auth Service**: Standalone Node.js + Hono + BetterAuth at `backends/node/services/auth/`
- **SvelteKit**: Uses proxy pattern (`/api/auth/*` → Auth Service). `createAuthClient` works normally.
- **.NET Gateways**: Validate JWTs via JWKS endpoint (no BetterAuth dependency)
- **Keycloak**: REMOVED - do not reference or use

### Rate Limiting

- **Packages**: `@d2/ratelimit` (Node.js), `D2.RateLimit.Redis` (C#)
- **Storage**: Redis (shared across all services)
- **Dimensions**: IP, userId, fingerprint, city, country
- **Logic**: If ANY dimension exceeds threshold → block ALL
- **Thresholds**: Anonymous (lower) and authenticated (higher)

### Geo Caching

- **Packages**: `@d2/geo-cache` (Node.js), `D2.Geo.Cache` (C#)
- Local memory cache for WhoIs data to avoid Geo service bombardment
- TTL: 1 hour, LRU eviction

---

## Node.js / TypeScript Conventions

### Project Structure

```
backends/node/
├── services/
│   └── auth/                 # BetterAuth service
│       ├── package.json
│       ├── src/
│       │   ├── index.ts      # Hono app entry
│       │   ├── auth.ts       # BetterAuth config
│       │   └── routes/
│       └── Dockerfile
│
contracts/node/
├── ratelimit/                # @d2/ratelimit package
├── geo-cache/                # @d2/geo-cache package
└── tsconfig.base.json        # Shared TypeScript config
```

### TypeScript Style

- **Strict mode**: Always enabled
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Imports**: Use `type` imports for type-only imports
- **Error handling**: Use Result pattern where applicable (similar to D2Result)

### Package Naming

- Internal packages: `@d2/{package-name}`
- Use pnpm workspaces for monorepo management

---

## Critical Reminders for Claude

1. **No Keycloak** - It has been removed. Auth uses BetterAuth.

2. **Check PLANNING.md** - For current sprint focus and status.

3. **JWT validation for .NET** - Use `Microsoft.IdentityModel.Tokens` with JWKS from Auth Service.

4. **SvelteKit auth** - Uses proxy pattern, NOT direct BetterAuth integration.

5. **Rate limiting is multi-dimensional** - IP + userId + fingerprint + city + country. All dimensions tracked, any exceeds = block all.

6. **Geo caching packages** - Create local cache wrappers to avoid bombarding Geo service with WhoIs lookups.
