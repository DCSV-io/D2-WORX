# @d2/interfaces

Contract interfaces for cache operations and middleware. Follows TLC→2LC→3LC folder convention with one handler per file. Mirrors `D2.Shared.Interfaces` in .NET. Layer 2.

## Structure

```
src/
├── caching/
│   ├── in-memory/         # 5 handler interfaces
│   │   └── handlers/
│   │       ├── r/         # Get, GetMany
│   │       ├── u/         # Set, SetMany
│   │       └── d/         # Remove
│   └── distributed/       # 7 handler interfaces
│       └── handlers/
│           ├── c/         # SetNx
│           ├── r/         # Get, Exists, GetTtl
│           ├── u/         # Set, Increment
│           └── d/         # Remove
└── middleware/
    ├── request-enrichment/  # IRequestInfo contract
    ├── ratelimit/           # ICheckHandler + RateLimitDimension + CHECK_REDACTION
    │   └── handlers/
    └── idempotency/         # ICheckHandler + IdempotencyState + CachedResponse
        └── handlers/
```

---

## Caching — In-Memory

| File                     | Handler           | Description                                   |
| ------------------------ | ----------------- | --------------------------------------------- |
| `handlers/r/get.ts`      | `IGetHandler`     | Retrieve single typed value by key.           |
| `handlers/r/get-many.ts` | `IGetManyHandler` | Batch retrieve typed values by multiple keys. |
| `handlers/u/set.ts`      | `ISetHandler`     | Store single typed value with optional TTL.   |
| `handlers/u/set-many.ts` | `ISetManyHandler` | Batch store typed values with optional TTL.   |
| `handlers/d/remove.ts`   | `IRemoveHandler`  | Delete single entry by key.                   |

## Caching — Distributed

| File                      | Handler             | Description                                         |
| ------------------------- | ------------------- | --------------------------------------------------- |
| `handlers/c/set-nx.ts`    | `ISetNxHandler`     | SET if Not eXists with optional TTL (for locks).    |
| `handlers/r/get.ts`       | `IGetHandler`       | Retrieve typed value from distributed cache by key. |
| `handlers/r/exists.ts`    | `IExistsHandler`    | Check key existence without retrieval.              |
| `handlers/r/get-ttl.ts`   | `IGetTtlHandler`    | Get remaining TTL of a key in milliseconds.         |
| `handlers/u/set.ts`       | `ISetHandler`       | Store typed value with optional TTL.                |
| `handlers/u/increment.ts` | `IIncrementHandler` | Atomic counter increment with optional TTL.         |
| `handlers/d/remove.ts`    | `IRemoveHandler`    | Delete key from distributed cache.                  |

## Middleware — Request Enrichment

| File                | Export         | Description                                                        |
| ------------------- | -------------- | ------------------------------------------------------------------ |
| `i-request-info.ts` | `IRequestInfo` | Interface for enriched request data (clientIp, fingerprints, geo). |

## Middleware — Rate Limit

| File                      | Export               | Description                                                    |
| ------------------------- | -------------------- | -------------------------------------------------------------- |
| `rate-limit-dimension.ts` | `RateLimitDimension` | Enum: Fingerprint, Ip, City, Country.                          |
| `handlers/check.ts`       | `ICheckHandler`      | Handler interface for rate limit checking + `CHECK_REDACTION`. |

## Middleware — Idempotency

| File                   | Export             | Description                                                  |
| ---------------------- | ------------------ | ------------------------------------------------------------ |
| `idempotency-state.ts` | `IdempotencyState` | String union: `"acquired"`, `"in_flight"`, `"cached"`.       |
| `cached-response.ts`   | `CachedResponse`   | Cached HTTP response shape (statusCode, headers, body).      |
| `handlers/check.ts`    | `ICheckHandler`    | Handler interface for idempotency check + `CHECK_REDACTION`. |

---

## Namespace Exports

Consumers import by namespace:

```typescript
import { InMemoryCache, DistributedCache, RateLimit, Idempotency } from "@d2/interfaces";
import type { RequestEnrichment } from "@d2/interfaces";

// Use as:
const handler: InMemoryCache.IGetHandler = ...;
const input: DistributedCache.SetInput<string> = ...;
const check: RateLimit.ICheckHandler = ...;
const idemCheck: Idempotency.ICheckHandler = ...;
```

## .NET Equivalent

- **Caching:** `D2.Shared.Interfaces/Caching/` — same TLC hierarchy with partial interfaces
- **Middleware:** Contracts are co-located with implementations in .NET (`RateLimit.Default/Interfaces/`), centralized here on Node.js side
