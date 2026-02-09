# Idempotency Middleware (ADR-007)

Shared idempotency middleware that prevents duplicate mutations when clients retry requests. Uses an `Idempotency-Key` header with distributed cache (Redis) for deduplication.

## Architecture

### Request Flow

```
1. Non-mutation (GET/HEAD/OPTIONS) or no header -> skip
2. Invalid key (non-UUID) -> 400 Bad Request
3. SET NX sentinel "__processing__" with 30s TTL:
   - Acquired -> execute request, cache response (24h), return
   - Key exists + sentinel -> 409 Conflict (in-flight)
   - Key exists + CachedResponse JSON -> replay cached response
   - Any error -> fail-open (allow request through)
```

### Cached Response Shape

```json
{
  "statusCode": 201,
  "body": "{\"id\":\"123\"}",
  "contentType": "application/json"
}
```

Only statusCode, body, and contentType are cached. Other headers (CORS, Set-Cookie) are set by other middleware on every request.

### Cache Key Format

```
idempotency:{uuid}
```

## Options

| Option              | Default    | Description                                               |
| ------------------- | ---------- | --------------------------------------------------------- |
| `CacheTtl`          | 24 hours   | TTL for cached responses                                  |
| `InFlightTtl`       | 30 seconds | TTL for the in-flight sentinel (safety valve)             |
| `MaxBodySizeBytes`  | 1 MB       | Max response body size to cache                           |
| `ApplicableMethods` | POST, PUT, PATCH, DELETE | HTTP methods the middleware applies to       |
| `CacheErrorResponses` | false    | Whether to cache 4xx/5xx responses                        |

## Packages

| Platform | Package                             | Layer |
| -------- | ----------------------------------- | ----- |
| .NET     | `D2.Shared.Idempotency.Default`     | Middleware |
| Node.js  | `@d2/idempotency`                   | Middleware |

## .NET Usage

```csharp
// Program.cs
builder.Services.AddIdempotency(builder.Configuration);

// Middleware pipeline (after auth, before endpoints)
app.UseIdempotency();
```

### Configuration (appsettings.json)

```json
{
  "IdempotencyOptions": {
    "CacheTtl": "1.00:00:00",
    "InFlightTtl": "00:00:30",
    "MaxBodySizeBytes": 1048576,
    "CacheErrorResponses": false
  }
}
```

## Node.js Usage

### Check Handler (DI composition)

```typescript
import { Check } from "@d2/idempotency";

const checkHandler = new Check(setNxHandler, getHandler, options, context);
```

### Framework-Agnostic Orchestrator

```typescript
import { checkIdempotency } from "@d2/idempotency";

const result = await checkIdempotency(
  idempotencyKey, checkHandler, setHandler, removeHandler, options, logger
);

if (result.state === "in_flight") return c.json({ error: "In-flight" }, 409);
if (result.state === "cached")    return replay(result.cachedResponse);

// Execute request...
const response = await next();

if (response.ok && bodySize <= maxBytes) {
  await result.storeResponse({ statusCode, body, contentType });
} else {
  await result.removeLock();
}
```

## Edge Cases

| Scenario                   | Behavior                                              |
| -------------------------- | ----------------------------------------------------- |
| 4xx/5xx response           | NOT cached (default). Sentinel removed. Retry allowed |
| Body > MaxBodySizeBytes    | NOT cached. Sentinel removed. Warning logged          |
| Redis down during SET NX   | Fail-open: request proceeds (duplicate possible)      |
| Redis down during store    | Response already sent. Warning logged                 |
| Server crashes mid-request | Sentinel expires after 30s. Next request proceeds     |
| Same key, different method | Same cache key — key is not method-scoped             |

## Dependencies

### New: SetNx Distributed Cache Handler

Added `ICreate.ISetNxHandler<TValue>` to both platforms — wraps Redis `SET ... NX` (set if not exists). Returns `{ wasSet: bool }`.

### Error Code

`IDEMPOTENCY_IN_FLIGHT` — returned in 409 Conflict responses when a duplicate request is in-flight.

## File Structure

### .NET (`Idempotency.Default/`)

| File                               | Purpose                                    |
| ---------------------------------- | ------------------------------------------ |
| `IdempotencyMiddleware.cs`         | ASP.NET Core middleware (response capture)  |
| `IdempotencyOptions.cs`            | Configuration with defaults                 |
| `CachedResponse.cs`                | Record for cached HTTP response             |
| `IdempotencyState.cs`              | Enum: Acquired, InFlight, Cached            |
| `Extensions.cs`                    | `AddIdempotency` + `UseIdempotency`         |
| `Interfaces/IIdempotency.cs`       | Base partial interface                      |
| `Interfaces/IIdempotency.Check.cs` | Check handler contract                      |
| `Handlers/X/Check.cs`              | SET NX + GET handler                        |

### Node.js (`@d2/idempotency`)

| File                        | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `handlers/check.ts`         | Check handler (BaseHandler)              |
| `check-idempotency.ts`      | Framework-agnostic orchestrator          |
| `idempotency-options.ts`    | Options + defaults                       |
| `index.ts`                  | Barrel exports                           |

### Shared Additions

| File                           | Package           | Change              |
| ------------------------------ | ----------------- | ------------------- |
| `ICreate.SetNx.cs`            | D2.Shared.Interfaces | New SetNx contract |
| `SetNx.cs` (Redis)            | DistributedCache.Redis | Redis SET NX impl |
| `set-nx.ts` (interface)       | @d2/interfaces    | New SetNx contract   |
| `set-nx.ts` (Redis)           | @d2/cache-redis   | Redis SET NX impl    |
| `ErrorCodes.cs`               | D2.Shared.Result  | + IDEMPOTENCY_IN_FLIGHT |
| `error-codes.ts`              | @d2/result        | + IDEMPOTENCY_IN_FLIGHT |
