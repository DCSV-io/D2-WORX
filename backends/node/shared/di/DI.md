# @d2/di

Lightweight dependency injection container mirroring .NET's `IServiceCollection` / `IServiceProvider`. Zero runtime dependencies. Layer 0.

## Files

| File Name                                          | Description                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [service-key.ts](src/service-key.ts)               | `ServiceKey<T>` branded runtime token + `createServiceKey<T>()` factory. Phantom type replaces erased TS interfaces. |
| [lifetime.ts](src/lifetime.ts)                     | `Lifetime` enum: `Singleton`, `Scoped`, `Transient`.                                                                 |
| [service-collection.ts](src/service-collection.ts) | `ServiceCollection` registration builder with `addSingleton`, `addScoped`, `addTransient`, `addInstance`, `build`.   |
| [service-provider.ts](src/service-provider.ts)     | `ServiceProvider` (root) + `ServiceScope` (child). Resolution, caching, disposal, and `Symbol.dispose` support.      |
| [index.ts](src/index.ts)                           | Barrel re-export of all types and classes.                                                                           |

---

## Core Concepts

### ServiceKey

Branded runtime token carrying phantom type information. Replaces erased TypeScript interfaces as DI lookup keys.

```typescript
const IMyServiceKey = createServiceKey<IMyService>("IMyService");
```

Keys are frozen objects. The `id` string is used at runtime; the `T` type parameter is used at compile time for type-safe `resolve<T>()`.

### Lifetime

| Lifetime      | Cached In | Factory Receives | Can Depend On         |
| ------------- | --------- | ---------------- | --------------------- |
| **Singleton** | Root      | Root provider    | Other singletons only |
| **Scoped**    | Per scope | Scope provider   | Singletons + scoped   |
| **Transient** | Never     | Current provider | Singletons + scoped   |

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

### setInstance + resolve Interaction

`scope.setInstance(key, value)` places the value directly in the scope's cache. However, `scope.resolve(key)` checks the root descriptor registry first and throws if the key was never registered. The scope cache is only checked **after** finding a matching descriptor.

**Correct pattern:** Always register a scoped factory for keys that will be set via `setInstance()`. The factory acts as a fallback and satisfies the descriptor lookup. Then `setInstance()` overrides it in the scope cache before any `resolve()` call:

```typescript
// Registration (once)
services.addScoped(IRequestContextKey, () => {
  throw new Error("Must setInstance");
});

// Per-request scope
const scope = provider.createScope();
scope.setInstance(IRequestContextKey, actualContext); // overrides the factory
const ctx = scope.resolve(IRequestContextKey); // returns actualContext
```

---

## Registration Pattern

Each service layer exports an `addXxx()` function that registers its handlers:

| Layer | Function                                    | Example Registrations                     |
| ----- | ------------------------------------------- | ----------------------------------------- |
| Infra | `addAuthInfra(services, db)`                | Repositories, BetterAuth adapter, mappers |
| App   | `addAuthApp(services, options)`             | CQRS handlers (scoped), pub/sub handlers  |
| API   | Composition root calls `addXxx` in sequence | Wire infra → app → build provider         |

### Key Placement

ServiceKeys live in the **app** package alongside the interfaces they represent. Infra re-exports from app to avoid circular dependencies.

---

## Root Provider Behavior

The root `ServiceProvider` can **only** resolve singleton and transient services. Scoped services resolved from root throw immediately:

```typescript
const scopedKey = createServiceKey<MyService>("MyService");
services.addScoped(scopedKey, () => new MyService());
const provider = services.build();

provider.resolve(scopedKey); // THROWS: "Cannot resolve scoped service from root"

const scope = provider.createScope();
scope.resolve(scopedKey); // OK — scoped resolved from scope
```

This enforces the **captive dependency rule**: singleton factories always receive the root provider (which can only resolve singletons). A singleton cannot accidentally depend on a scoped service. Scoped/transient factories receive the scope provider (which can resolve both singletons and scoped).

**Error caching:** If a singleton factory throws during resolution, the error is NOT cached — the factory will be re-invoked on the next `resolve()` call. This matches .NET behavior and allows transient failures (e.g., missing config at startup) to self-heal.

---

## Debug Logging

Set `DEBUG_DI=true` environment variable to enable verbose resolution logging. Logs include:

- `Resolving {key}` — every `resolve()` call
- `Singleton cache hit: {key}` / `Scope cache hit: {key}` — cache hits
- `Creating {key} via factory` — factory invocations
- `setInstance: {key}` — instance overrides
- `CIRCULAR: {chain}` — circular dependency detection

Zero cost when `DEBUG_DI` is not set (single boolean check).

---

## .NET Equivalent

`Microsoft.Extensions.DependencyInjection` — `IServiceCollection`, `IServiceProvider`, `IServiceScope`. Same lifetime semantics, same captive dependency rules.
