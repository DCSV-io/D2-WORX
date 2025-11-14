# MemoryCache.Default

Default in-memory caching implementation using IMemoryCache. Provides fast process-local caching with automatic memory management and expiration support.

## Files

| File Name                                                    | Description                                                                                                          |
|--------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| [DefaultMemoryCacheService.cs](DefaultMemoryCacheService.cs) | Service facade implementing IMemoryCacheService, creating typed handler instances for each cache operation.          |
| [Get.cs](Handlers/Get.cs)                                    | Handler retrieving values from IMemoryCache, returning NotFound result when key doesn't exist.                       |
| [Set.cs](Handlers/Set.cs)                                    | Handler storing values in IMemoryCache with optional expiration, supports both sliding and absolute timeouts.        |
| [Remove.cs](Handlers/Remove.cs)                              | Handler removing cache entries by key, always returns success (idempotent operation).                                |
| [Extensions.cs](Extensions.cs)                               | DI extension methods registering DefaultMemoryCacheService and underlying IMemoryCache with AddDefaultMemoryCaching. |
