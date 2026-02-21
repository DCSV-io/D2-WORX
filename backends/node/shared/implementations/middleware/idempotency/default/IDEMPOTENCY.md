# @d2/idempotency

Idempotency-Key header middleware using Redis-backed SET NX + cached response replay. Mirrors `Idempotency.Default` in .NET. Layer 5.

## Files

| File Name                                            | Description                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [handlers/check.ts](src/handlers/check.ts)           | `Check` handler — SET NX sentinel, detect in-flight/cached state. Fail-open.                               |
| [check-idempotency.ts](src/check-idempotency.ts)     | Framework-agnostic orchestrator returning `IdempotencyResult` with `storeResponse`/`removeLock` callbacks. |
| [idempotency-options.ts](src/idempotency-options.ts) | `IdempotencyOptions` + `DEFAULT_IDEMPOTENCY_OPTIONS` (24h cache, 30s lock, 1MB max body).                  |
| [index.ts](src/index.ts)                             | Barrel re-export of Check, checkIdempotency, IdempotencyOptions.                                           |

## Flow

```
1. Client sends request with `Idempotency-Key` header
2. Check handler: SET NX "{sentinel}" with inFlightTtlMs
   ├── Key acquired → proceed with request
   ├── Key exists, value = sentinel → return "in_flight" (409)
   └── Key exists, value = JSON → return "cached" (replay response)
3. After downstream completes:
   ├── storeResponse() → SET cached JSON with cacheTtlMs
   └── removeLock() → REMOVE key (if response not cacheable)
```

## Options

| Option             | Default    | Description                            |
| ------------------ | ---------- | -------------------------------------- |
| `cacheTtlMs`       | 86,400,000 | TTL for cached responses (24 hours)    |
| `inFlightTtlMs`    | 30,000     | TTL for in-flight sentinel lock (30s)  |
| `maxBodySizeBytes` | 1,048,576  | Max response body size to cache (1 MB) |

## Dependencies

- `@d2/interfaces` — `DistributedCache.ISetNxHandler`, `DistributedCache.IGetHandler`, `DistributedCache.ISetHandler`, `DistributedCache.IRemoveHandler`
- `@d2/handler` — BaseHandler
- `@d2/result` — D2Result

## .NET Equivalent

`Idempotency.Default` — ASP.NET Core middleware with `IIdempotencyFilter` endpoint filter.
