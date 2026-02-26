# @d2/cache-memory

In-memory cache implementation with Map-backed store and LRU eviction. Mirrors `InMemoryCache.Default` in .NET. Layer 3.

## Files

| File Name                                            | Description                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| [memory-cache-store.ts](src/memory-cache-store.ts)   | `MemoryCacheStore` class — Map-backed with lazy TTL eviction and LRU.        |
| [handlers/r/get.ts](src/handlers/r/get.ts)           | `Get` handler — retrieve single entry by key.                                |
| [handlers/r/get-many.ts](src/handlers/r/get-many.ts) | `GetMany` handler — batch retrieve entries by multiple keys.                 |
| [handlers/u/set.ts](src/handlers/u/set.ts)           | `Set` handler — store single entry with optional TTL.                        |
| [handlers/u/set-many.ts](src/handlers/u/set-many.ts) | `SetMany` handler — batch store entries with optional TTL.                   |
| [handlers/d/remove.ts](src/handlers/d/remove.ts)     | `Remove` handler — delete entry by key.                                      |
| [service-keys.ts](src/service-keys.ts)               | ServiceKey factories for MemoryCacheStore and cache handler DI registration. |
| [index.ts](src/index.ts)                             | Barrel re-export of `MemoryCacheStore` + all handlers.                       |

## MemoryCacheStore

Standalone Map-backed cache with:

- **Lazy TTL eviction** — expired entries cleaned up on access (lazy eviction, no periodic sweep)
- **Always-on LRU** — delete + re-insert on get promotes to MRU; oldest evicted on set when at capacity
- **Default max entries:** 10,000 (configurable via `maxEntries` option)
- **No external dependencies** — pure TypeScript, no `IMemoryCache` or framework caching

## Handler Structure

Follows TLC folder convention matching `@d2/interfaces`:

```
handlers/
├── r/          # Read: Get, GetMany
├── u/          # Update: Set, SetMany
└── d/          # Delete: Remove
```

All handlers extend `BaseHandler` from `@d2/handler` and implement interfaces from `@d2/interfaces`.

## .NET Equivalent

`InMemoryCache.Default` — uses `IMemoryCache` from `Microsoft.Extensions.Caching.Memory`. The Node.js version uses a custom Map-backed store instead since there's no equivalent framework cache.
