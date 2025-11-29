# CLAUDE.md — D²-WORX Development Guide

This file provides guidance for Claude Code when working with the D²-WORX codebase.

## Project Overview

**D²-WORX** (Decisive Distributed Application Framework) is a microservices-based evolution of DeCAF, designed for SMB SaaS applications. It combines .NET 10 backend services with a SvelteKit frontend, orchestrated via .NET Aspire.

**Status:** Pre-Alpha (Core Infrastructure)
**License:** PolyForm Strict (reference implementation, non-commercial)

## Quick Reference

### Essential Commands

```bash
# Backend (from backends/AppHost)
dotnet run                              # Start all services via Aspire
dotnet build                            # Build solution
dotnet test                             # Run all tests

# Frontend (from frontends/sveltekit)
pnpm install                            # Install dependencies
pnpm dev                                # Start dev server
pnpm test:unit                          # Run Vitest
pnpm test:e2e                           # Run Playwright
pnpm check                              # Type-check
pnpm lint                               # Prettier + ESLint
pnpm format                             # Auto-format
```

### Key URLs (when running)
- Aspire Dashboard: `http://localhost:15888`
- Grafana: `http://localhost:3000`
- SvelteKit Dev: `http://localhost:5173`

## Project Structure

```
D2-WORX/
├── backends/
│   ├── AppHost/                    # Aspire orchestration
│   ├── Contracts/                  # Shared abstractions
│   │   ├── Handler/                # BaseHandler pattern
│   │   ├── Interfaces/             # Contract interfaces
│   │   ├── Messages/               # Domain event POCOs
│   │   ├── Result/                 # D2Result pattern
│   │   ├── ServiceDefaults/        # OpenTelemetry config
│   │   ├── Tests/                  # Shared test infrastructure
│   │   ├── Utilities/              # Extensions & helpers
│   │   └── Implementations/        # Reusable implementations
│   │       ├── Caching/            # Redis & In-Memory
│   │       ├── Common/             # GeoRefData
│   │       └── Repository/         # Transactions
│   ├── Gateways/
│   │   └── REST/                   # HTTP/REST → gRPC gateway
│   └── Services/
│       ├── Geo/                    # Geographic reference data
│       │   ├── Geo.Domain/         # DDD entities
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

## Architecture & Patterns

### TLC→2LC→3LC Folder Convention

All backend code follows a three-level categorization:

**TLC (Top-Level):** Architectural concern
- `CQRS` - Command/Query segregation
- `Messaging` - Async pub-sub
- `Repository` - Data access
- `Caching` - Cache layers

**2LC (Second-Level):** Implementation type
- `Handlers` - Business logic
- `Entities` - EF Core configs
- `Migrations` - Database evolution
- `MT` - MassTransit adapters

**3LC (Third-Level):** Operation type
- `C/` - Commands (writes)
- `Q/` - Queries (reads)
- `X/` - Complex operations
- `R/` - Repository reads
- `Pub/`, `Sub/` - Publish/Subscribe

### Handler Pattern

Handlers use `BaseHandler<Self, Input, Output>` with automatic logging, tracing, and error handling:

```csharp
using H = ICommands.ISetInMemHandler;
using I = ICommands.SetInMemInput;
using O = ICommands.SetInMemOutput;

public class SetInMem : BaseHandler<SetInMem, I, O>, H
{
    protected override ValueTask<D2Result<O?>> ExecuteAsync(
        I input, CancellationToken ct = default)
    {
        // Implementation
    }
}
```

### D2Result Pattern

Use result objects instead of exceptions for control flow:

```csharp
// Success
D2Result.Ok()
D2Result<TData>.Ok(data, traceId)

// Failures
D2Result.Fail(messages, statusCode, errorCode)
D2Result.ValidationFailed(inputErrors, traceId)
D2Result.NotFound(traceId)
D2Result.Unauthorized(traceId)

// Checking results
if (result.CheckSuccess(out var output)) { /* use output */ }
return result.BubbleFail<TNewData>();  // Propagate errors
```

### Partial Interface Extension

Split interfaces across files for modularity:

```csharp
// ICommands.cs
public partial interface ICommands { }

// ICommands.SetInMem.cs
public partial interface ICommands
{
    public interface ISetInMemHandler : IHandler<SetInMemInput, SetInMemOutput>;
    public record SetInMemInput(GetReferenceDataResponse Data);
    public record SetInMemOutput;
}
```

## Code Conventions

### C# Style

**File Headers (required):**
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

**Naming:**
- Classes/Records/Interfaces: `PascalCase`
- Methods/Properties: `PascalCase`
- Private fields: `_camelCase`
- Constants: `UPPER_CASE`
- Local variables: `camelCase`

**Entity Design:**
- Use `record` types for immutability
- Use `required init` for mandatory properties
- Initialize collections as empty: `ICollection<T> { }` or `[]`

### TypeScript/Frontend Style

- Strict TypeScript enabled
- ESLint + Prettier enforced
- Tailwind CSS v4.1 for styling

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

**Naming:** `[Method]_[Scenario]_[ExpectedResult]`

**Integration tests with Testcontainers:**
```csharp
[MustDisposeResource(false)]
public class MyTests : IAsyncLifetime
{
    private PostgreSqlContainer _container = null!;

    public async ValueTask InitializeAsync()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:18")
            .Build();
        await _container.StartAsync(Ct);
    }
}
```

### Frontend Tests

- **Unit:** Vitest for components/utilities
- **E2E:** Playwright for user workflows

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

**Scope notation:** `feat(geo): add primary locales`

## Infrastructure

### Services (via Aspire)
- **PostgreSQL 18** - Per-service databases
- **Redis 8.2** - Distributed cache
- **RabbitMQ 4.1** - Async messaging (MassTransit)
- **MinIO** - Object storage (S3-compatible)
- **Keycloak 26.4** - Identity management
- **LGTM Stack** - Observability (Loki, Grafana, Tempo, Mimir)

### Communication Patterns
- **Sync:** gRPC between services (HTTP/2)
- **Async:** RabbitMQ events via MassTransit
- **Caching:** Redis (distributed) → Memory (process) → Disk (fallback)

## Key Documentation

- `backends/BACKENDS.md` - Backend architecture reference
- `backends/Contracts/Handler/HANDLER.md` - Handler pattern guide
- `backends/Contracts/Result/RESULT.md` - D2Result pattern
- `backends/Services/Geo/GEO_SERVICE.md` - Geo service docs
- `CONTRIBUTING.md` - Contribution guidelines

## Development Workflow

### Adding a New Feature

1. Create handler following `BaseHandler<Self, Input, Output>` pattern
2. Use TLC→2LC→3LC folder structure
3. Define interface in `Interfaces/` with partial extension pattern
4. Register in `Extensions.cs` via DI
5. Add unit tests in `Tests/Unit/`
6. Add integration tests in `Tests/Integration/` with Testcontainers
7. Write XML documentation on all public types
8. Include license headers in new files
9. Follow conventional commit format

### Initial Setup

1. Clone repository
2. Set secrets in `backends/AppHost`:
   ```bash
   dotnet user-secrets set Parameters:db-username <value>
   dotnet user-secrets set Parameters:db-password <value>
   dotnet user-secrets set Parameters:mq-username <value>
   dotnet user-secrets set Parameters:mq-password <value>
   dotnet user-secrets set Parameters:cache-password <value>
   dotnet user-secrets set Parameters:kc-username <value>
   dotnet user-secrets set Parameters:kc-password <value>
   dotnet user-secrets set Parameters:otel-username <value>
   dotnet user-secrets set Parameters:otel-password <value>
   dotnet user-secrets set Parameters:s3-username <value>
   dotnet user-secrets set Parameters:s3-password <value>
   dotnet user-secrets set Parameters:dba-email <value>
   dotnet user-secrets set Parameters:dba-password <value>
   ```
3. Create `frontends/sveltekit/.env` from `.env.example`
4. Run `dotnet run` in `backends/AppHost`
5. Run `pnpm dev` in `frontends/sveltekit`

## Notes for Claude

- This is a **reference implementation** showing DeCAF → D² evolution
- Emphasizes **strong DX**: minimal boilerplate, clear patterns, automatic instrumentation
- All major patterns are established; follow existing conventions
- Currently in Pre-Alpha: Geo service is the primary implementation focus
- Use existing documentation files (*.md) as authoritative references
- When in doubt, check similar existing implementations in codebase
