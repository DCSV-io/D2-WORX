# Backend Architecture & Organization

## Overview

The D²-WORX backend follows a **hierarchical, three-tier categorization system** (TLC→2LC→3LC) that provides consistent organization across all projects, from shared contracts to service-specific implementations. This structure prioritizes discoverability, maintainability, and scalability.

---

## The Three-Tier Hierarchy

### TLC (Top-Level Category)
**What:** Primary architectural concern
**Examples:** `CQRS`, `Messaging`, `Repository`, `Caching`

### 2LC (Second-Level Category)
**What:** Implementation detail or subdivision
**Examples:** `Handlers`, `MassTransit`, `Entities`, `Migrations`

### 3LC (Third-Level Category)
**What:** Specific pattern or operation type
**Examples:** `C` (Commands), `Q` (Queries), `Pub` (Publishers), `Sub` (Subscribers)

---

## Category Definitions

### CQRS (Command Query Responsibility Segregation)

Separates read operations (queries) from write operations (commands) with clear semantic boundaries.

**Structure:**
```
CQRS/
  Handlers/
    C/  → Commands (state-changing operations)
    Q/  → Queries (read-only operations)
    U/  → Utilities (neither read nor write, e.g., validation)
    X/  → Complex (operations with side effects spanning multiple concerns)
```

**Rationale:**
- **C (Commands):** Clear intent that this operation modifies state
- **Q (Queries):** Guarantees no side effects, safe for caching/optimization
- **U (Utilities):** Helper operations that don't fit strict CQRS patterns
- **X (Complex):** Real-world operations that span both concerns (e.g., Get with cache population)

### Messaging (Async Event-Driven Communication)

Enables loosely-coupled service communication via pub-sub patterns using RabbitMQ/MassTransit.

**Structure:**
```
Messaging/
  Handlers/
    Pub/  → Publisher handlers (send messages)
    Sub/  → Subscriber handlers (receive messages)
  MT/  → MassTransit infrastructure
    Consumers/  → MassTransit IConsumer implementations
    Publishers/  → MassTransit publisher classes (if needed)
```

**Rationale:**
- **Handlers/Pub & Sub:** Business logic remains framework-agnostic
- **MT/:** MassTransit-specific adapters isolated from domain logic
- Separation allows testing handlers without message infrastructure

### Repository (Data Access & Persistence)

Encapsulates database operations following CRUD patterns with additional infrastructure concerns.

**Structure:**
```
Repository/
  Handlers/
    C/  → Create operations
    R/  → Read operations
    U/  → Update operations
    D/  → Delete operations
  Entities/  → EF Core configurations
  Migrations/  → Database schema evolution
  Seeding/  → Initial/reference data
  Transactions/  → Transaction control handlers
```

**Rationale:**
- **CRUD separation:** Clear boundaries for each operation type
- **Transactions at same level:** Transaction control is orthogonal to CRUD
- **Entities/Migrations/Seeding:** Infrastructure concerns grouped together

### Caching (Multi-Tier Cache Strategy)

Provides layered caching with abstract, distributed, and in-memory implementations.

**Structure:**
```
Caching/
  Abstract/  → Base interfaces for cache operations
    Handlers/
      C/, R/, U/, D/  → CRUD-style cache operations
  Distributed/  → Redis-backed shared cache
    Handlers/
      C/, R/, U/, D/
  InMemory/  → Process-local cache
    Handlers/
      C/, R/, U/, D/
```

**Rationale:**
- **Abstract provides contracts:** Services code against interfaces
- **Distributed vs InMemory:** Clear separation of cache tiers
- **Same CRUD pattern:** Consistency with Repository layer

---

## Project Types & Their Structure

### Contracts (Interfaces)

**Purpose:** Define "what" without "how" - pure abstractions

**Structure:**
```
Contracts/
  Handler/  → Base handler abstractions
  Interfaces/  → All interface definitions following TLC hierarchy
  Messages/  → Pure POCO message contracts (no dependencies)
  Result/  → D2Result pattern
  Utilities/  → Shared helpers
```

**Key Principle:** Zero implementation, maximum contract definition

### Contracts (Implementations)

**Purpose:** Reusable, drop-in implementations of contract interfaces

**Structure:**
```
Implementations/
  Caching/
    Distributed/
      DistributedCache.Redis/  → Redis implementation
    InMemory/
      InMemoryCache.Default/  → Memory implementation
  Common/
    GeoRefData.Default/  → Shared georeference logic
  Repository/
    Transactions/
      Transactions.Pg/  → PostgreSQL transactions
```

**Key Principle:** Services consume these via DI without reinventing common functionality

### Service Projects (Domain-Specific)

Each service follows clean architecture with domain, application, infrastructure, and API layers.

**Structure:**
```
ServiceName/
  ServiceName.Domain/  → Entities, value objects, domain logic
  ServiceName.App/
    Interfaces/
      CQRS/
      Messaging/
      Repository/
  ServiceName.Infra/
    CQRS/
    Messaging/
    Repository/
  ServiceName.API/  → gRPC/REST endpoints
  ServiceName.Tests/
```

**Key Principle:** Each service owns its data and business logic

---

## Practical Guidelines

### When to Create a New Category

**Add a TLC when:**
- You have a fundamentally new architectural concern (e.g., `Scheduling`, `Notifications`)
- It would contain 3+ handler files
- It's orthogonal to existing categories

**Add a 2LC when:**
- You need to separate implementation details (e.g., `Entities`, `Migrations`)
- Infrastructure adapters need isolation (e.g., `MassTransit`)

**Add a 3LC when:**
- You're subdividing operations by type (e.g., CRUD, Pub/Sub)

### Naming Conventions

- **Folders:** PascalCase (`Handlers`, `MassTransit`)
- **TLC folders:** Match architectural concern (`CQRS`, `Messaging`, `Repository`)
- **3LC folders:** Single-letter abbreviations (`C`, `Q`, `R`) or clear terms (`Pub`, `Sub`)
- **Files:** Match class name (e.g., `GetReferenceData.cs`)

### Extension Pattern

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

**Benefits:**
- One file per operation (easy to find)
- Grouped by common interface (discoverability)
- Clean using aliases in implementations

---

## Benefits of This Structure

### Consistency
Every project follows the same organizational pattern - once learned, navigating any project is intuitive.

### Scalability
Adding new operations, handlers, or categories follows established patterns without restructuring.

### Discoverability
File location tells you exactly what it does: `CQRS/Handlers/Q/GetReferenceData.cs` is obviously a query handler.

### Testability
Clear separation between business logic (Handlers) and infrastructure (MassTransit, EF Core) enables isolated testing.

### Maintainability
Changes are localized - updating caching strategy only affects `Caching/` implementations, not consumers.

---

## Common Patterns

### Handler Registration (DI)
```csharp
// In Extensions.cs
services.AddTransient<ICommands.ISetInMemHandler, SetInMem>();
services.AddTransient<IQueries.IGetFromMemHandler, GetFromMem>();
```

### MassTransit Consumer Registration
```csharp
// In service Infra Extensions.cs
services.AddMassTransit(x =>
{
    x.AddConsumer<UpdatedConsumer>();  // Register consumers
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(rabbitMqConnectionString);
        cfg.ConfigureEndpoints(context);
    });
});
```

### Using Aliases for Clean Implementations
```csharp
using H = ICommands.ISetInMemHandler;
using I = ICommands.SetInMemInput;
using O = ICommands.SetInMemOutput;

public class SetInMem : BaseHandler<SetInMem, I, O>, H
{
    protected override ValueTask<D2Result<O?>> ExecuteAsync(I input, CancellationToken ct)
    {
        // Implementation
    }
}
```

---

## Evolution & Flexibility

This structure is **descriptive, not prescriptive**. As D²-WORX evolves:

- New TLCs can emerge (e.g., `Scheduling`, `Notifications`)
- Existing categories can be refined (e.g., splitting `X` if it grows large)
- Services can adopt patterns selectively based on their needs

The hierarchy provides **guardrails without constraints**, enabling consistent growth without rigid enforcement.