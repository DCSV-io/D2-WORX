# InMemoryCache.Default

In-memory caching implementation using Microsoft.Extensions.Caching.Memory with handler-based CRUD operations for local cache management.

## Files

| File Name                      | Description                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| [Extensions.cs](Extensions.cs) | DI extension method AddDefaultMemoryCaching registering IMemoryCache and in-memory cache handlers. |

## Handlers

### C (Create)

No create handlers - MemoryCache Set operation is upsert (create or update).

### D (Delete)

| File Name                         | Description                                         |
| --------------------------------- | --------------------------------------------------- |
| [Remove.cs](Handlers/D/Remove.cs) | Handler for removing data from memory cache by key. |

### R (Read)

| File Name                           | Description                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Get.cs](Handlers/R/Get.cs)         | Handler for retrieving generic typed data from in-memory cache by single key.                  |
| [GetMany.cs](Handlers/R/GetMany.cs) | Handler for batch retrieval of multiple items from memory cache, returning found/missing keys. |

### U (Update)

| File Name                           | Description                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Set.cs](Handlers/U/Set.cs)         | Handler for storing (upsert) generic typed data in memory cache with optional TTL and size limit. |
| [SetMany.cs](Handlers/U/SetMany.cs) | Handler for batch storing multiple items in memory cache with shared TTL configuration.           |

## Usage Pattern

Typical Get → miss → Set flow. All operations go through handler abstractions (never raw `IMemoryCache`):

```csharp
// Try memory cache first
var memResult = await r_getFromMem.HandleAsync(new GetInput(cacheKey), ct);
if (memResult.CheckSuccess(out var cached))
{
    return D2Result<MyOutput?>.Ok(new MyOutput(cached!.Value));
}

// Memory miss — fetch from downstream source
var data = await FetchFromDownstream(input, ct);

// Populate memory cache for next request (fire-and-forget OK for cache writes)
await r_setInMem.HandleAsync(new SetInput<MyType>(cacheKey, data, TimeSpan.FromMinutes(5)), ct);

return D2Result<MyOutput?>.Ok(new MyOutput(data));
```

**Key behaviors:**
- `Get<TValue>` returns `NotFound` on cache miss (not null) — use `CheckSuccess` to distinguish
- `Set<TValue>` is upsert — overwrites existing entries for the same key
- Each entry has `Size = 1` — total cache size is controlled by `MemoryCacheOptions.SizeLimit`
- TTL is optional — entries without TTL persist until evicted by LRU
- All operations are synchronous (`ValueTask`-wrapped) since `IMemoryCache` is in-process
