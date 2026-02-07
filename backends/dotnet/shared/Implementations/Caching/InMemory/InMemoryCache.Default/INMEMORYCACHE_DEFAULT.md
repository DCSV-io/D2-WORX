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
