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

| Document               | Purpose                                                                      |
|------------------------|------------------------------------------------------------------------------|
| `README.md`            | Project overview, setup instructions, technology stack, and status           |
| `backends/BACKENDS.md` | Complete backend architecture, TLC→2LC→3LC hierarchy, and folder conventions |

## Project Structure

```
D2-WORX/
├── backends/
│   ├── AppHost/                    # Aspire orchestration
│   ├── Contracts/                  # Shared abstractions
│   │   ├── Handler/                # BaseHandler pattern
│   │   ├── Interfaces/             # Contract interfaces (TLC hierarchy)
│   │   ├── Implementations/        # Reusable implementations
│   │   │   ├── Caching/            # Redis & In-Memory
│   │   │   ├── Common/             # GeoRefData
│   │   │   └── Repository/         # Transactions
│   │   ├── Messages/               # Domain event POCOs
│   │   ├── Result/                 # D2Result pattern
│   │   ├── Result.Extensions/      # D2Result ↔ Proto conversions
│   │   ├── ServiceDefaults/        # OpenTelemetry config
│   │   ├── Tests/                  # Shared test infrastructure
│   │   └── Utilities/              # Extensions & helpers
│   ├── Gateways/
│   │   └── REST/                   # HTTP/REST → gRPC gateway
│   └── Services/
│       ├── _protos/                # Protocol Buffers definitions
│       │   └── _gen/Protos.DotNet/ # Generated C# code
│       ├── Geo/                    # Geographic reference data
│       │   ├── Geo.Domain/         # DDD entities & value objects
│       │   ├── Geo.App/            # CQRS handlers
│       │   ├── Geo.Infra/          # Repository, messaging, EF Core
│       │   ├── Geo.API/            # gRPC service
│       │   └── Geo.Tests/          # Tests
│       └── Auth/                   # Authentication (planned)
├── frontends/
│   └── sveltekit/                  # SvelteKit 5 app
├── observability/                  # LGTM stack configs
│   ├── alloy/, loki/, grafana/, tempo/, mimir/
├── .github/
│   ├── workflows/test.yml          # CI/CD pipeline
│   └── instructions/               # Copilot guidelines
├── .editorconfig                   # Code style rules
├── Directory.Build.props           # MSBuild/StyleCop config
├── stylecop.json                   # StyleCop settings
└── D2.sln                          # Solution file
```

---

## Architecture & Patterns

### TLC→2LC→3LC Folder Convention

All backend code follows a three-level categorization. See `backends/BACKENDS.md` for full details.

**TLC (Top-Level):** Architectural concern → `CQRS`, `Messaging`, `Repository`, `Caching`

**2LC (Second-Level):** Implementation type → `Handlers`, `Entities`, `Migrations`, `MT`

**3LC (Third-Level):** Operation type:
- `C/` - Commands (state-changing) / Create
- `Q/` - Queries (read-only, no side effects)
- `R/` - Repository reads
- `U/` - Updates / Utilities
- `D/` - Deletes
- `X/` - Complex (multi-step operations with side effects)
- `Pub/`, `Sub/` - Publish/Subscribe messaging

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
D2Result.Unauthorized(traceId: TraceId)

// Checking and propagating
if (result.CheckSuccess(out var output)) { /* use output */ }
return result.BubbleFail<TNewData>();  // Propagate errors with type change
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
        public IServiceCollection AddMyService()
        {
            // Register services
            return services;
        }
    }
}
```

### Multi-Tier Caching

Cache retrieval order: **Memory → Redis → Database → Disk**

Cache population: When data is retrieved from a lower tier, populate all higher tiers.

Update notifications: Only publish after distributed cache write succeeds.

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
| Private constants                    | `_UPPER_CASE`      | `_MAX_RETRIES`             |
| Public/Internal constants            | `UPPER_CASE`       | `MAX_ATTEMPTS`             |
| Local constants (in tests)           | `snake_case`       | `expected_count`           |
| Local variables                      | `camelCase`        | `result`                   |

**Entity Design:**
- Use `record` types for immutability
- Use `required init` for mandatory properties
- Initialize collections as empty: `ICollection<T> { }` or `[]`

**Database Conventions:**
- Column names: `snake_case` (configured via EF Core)
- Explicit schema control via entity type configurations

### TypeScript/Frontend Style

- Strict TypeScript enabled
- ESLint + Prettier enforced
- Tailwind CSS v4.1 for styling

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
- `Updated_WhenSetInMemFails_StillSucceeds`

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

### Frontend Tests

- **Unit:** Vitest for components/utilities
- **E2E:** Playwright for user workflows

---

## Git Conventions

### Branch Naming
- `feature/...` - New features
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
| Keycloak        | 26.4    | Identity management        |
| LGTM Stack      | Various | Observability              |

### Communication Patterns

- **Sync:** gRPC between services (HTTP/2)
- **Async:** RabbitMQ events via MassTransit
- **Caching:** Memory → Redis → Database → Disk (fallback)

---

## Additional Documentation

| Document                                    | Description                        |
|---------------------------------------------|------------------------------------|
| `backends/Contracts/Handler/HANDLER.md`     | Handler pattern guide              |
| `backends/Contracts/Result/RESULT.md`       | D2Result pattern                   |
| `backends/Contracts/Result.Extensions/`     | gRPC ↔ D2Result conversions        |
| `backends/Services/Geo/GEO_SERVICE.md`      | Geo service architecture           |
| `CONTRIBUTING.md`                           | Contribution guidelines            |

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
- Currently in Pre-Alpha: **Geo service is the primary implementation reference**

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

### When in Doubt

- Check similar existing implementations in codebase
- Reference the `*.md` documentation files
- Follow the patterns established in `Geo.App` and `Geo.Infra`
- Ask for clarification rather than guessing
