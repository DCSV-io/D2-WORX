# @d2/di

Lightweight dependency injection container mirroring .NET's `IServiceCollection` / `IServiceProvider`. Zero runtime dependencies. Layer 0.

## Files

| File Name                                            | Description                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [service-key.ts](src/service-key.ts)                 | `ServiceKey<T>` branded runtime token + `createServiceKey<T>()` factory. Phantom type replaces erased TS interfaces. |
| [lifetime.ts](src/lifetime.ts)                       | `Lifetime` enum: `Singleton`, `Scoped`, `Transient`.                                                               |
| [service-collection.ts](src/service-collection.ts)   | `ServiceCollection` registration builder with `addSingleton`, `addScoped`, `addTransient`, `addInstance`, `build`. |
| [service-provider.ts](src/service-provider.ts)       | `ServiceProvider` (root) + `ServiceScope` (child). Resolution, caching, disposal, and `Symbol.dispose` support.   |
| [index.ts](src/index.ts)                             | Barrel re-export of all types and classes.                                                                         |

---

## Core Concepts

### ServiceKey

Branded runtime token carrying phantom type information. Replaces erased TypeScript interfaces as DI lookup keys.

```typescript
const IMyServiceKey = createServiceKey<IMyService>("IMyService");
```

Keys are frozen objects. The `id` string is used at runtime; the `T` type parameter is used at compile time for type-safe `resolve<T>()`.

### Lifetime

| Lifetime      | Cached In   | Factory Receives | Can Depend On               |
| ------------- | ----------- | ---------------- | --------------------------- |
| **Singleton** | Root        | Root provider    | Other singletons only       |
| **Scoped**    | Per scope   | Scope provider   | Singletons + scoped         |
| **Transient** | Never       | Current provider | Singletons + scoped         |

**Captive dependency prevention**: Singleton factories receive the root provider, so they cannot accidentally capture scoped services. Scoped services resolved from root throw immediately.

### ServiceCollection

Registration builder. Each layer exports an `addXxx(services)` function:

```typescript
export function addAuthApp(services: ServiceCollection, options: AuthOptions): void {
  services.addScoped(ICreateOrgKey, (sp) => new CreateOrg(sp.resolve(IHandlerContextKey), ...));
}
```

Methods: `addSingleton()`, `addScoped()`, `addTransient()`, `addInstance()`, `has()`, `build()`.

### ServiceProvider / ServiceScope

`build()` returns a `ServiceProvider` (root). Call `createScope()` for per-request child scopes.

```typescript
const provider = services.build();

// Per-request scope
const scope = provider.createScope();
scope.setInstance(IRequestContextKey, requestContext);
const handler = scope.resolve(IMyHandlerKey);
scope.dispose();
```

`ServiceScope` supports TC39 explicit resource management (`Symbol.dispose`).

---

## Registration Pattern

Each service layer exports an `addXxx()` function that registers its handlers:

| Layer | Function                                    | Example Registrations                        |
| ----- | ------------------------------------------- | -------------------------------------------- |
| Infra | `addAuthInfra(services, db)`                | Repositories, BetterAuth adapter, mappers    |
| App   | `addAuthApp(services, options)`             | CQRS handlers (scoped), pub/sub handlers     |
| API   | Composition root calls `addXxx` in sequence | Wire infra → app → build provider            |

### Key Placement

ServiceKeys live in the **app** package alongside the interfaces they represent. Infra re-exports from app to avoid circular dependencies.

---

## .NET Equivalent

`Microsoft.Extensions.DependencyInjection` — `IServiceCollection`, `IServiceProvider`, `IServiceScope`. Same lifetime semantics, same captive dependency rules.
