# Interfaces

Service interface contracts defining standard patterns for caching, handlers, and cross-cutting concerns. Enables dependency inversion and testability across microservices.

## Files

| File Name                                                                                        | Description                                                                                                                                   |
|--------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| [ICommonCacheService.cs](CommonCacheService/ICommonCacheService.cs)                              | Base partial interface for common caching operations across in-memory and distributed implementations.                                        |
| [ICommonCacheService.Get.cs](CommonCacheService/ICommonCacheService.Get.cs)                      | Partial interface defining Get operation with IGetHandler, GetInput record (key), and GetOutput record (nullable value).                      |
| [ICommonCacheService.Set.cs](CommonCacheService/ICommonCacheService.Set.cs)                      | Partial interface defining Set operation with ISetHandler, SetInput record (key, value, optional expiration), and SetOutput record.           |
| [ICommonCacheService.Remove.cs](CommonCacheService/ICommonCacheService.Remove.cs)                | Partial interface defining Remove operation with IRemoveHandler, RemoveInput record (key), and RemoveOutput record.                           |
| [IMemoryCacheService.cs](MemoryCacheService/IMemoryCacheService.cs)                              | In-memory caching service contract extending ICommonCacheService for process-local caching scenarios.                                         |
| [IDistributedCacheService.cs](DistributedCacheService/IDistributedCacheService.cs)               | Distributed caching service partial interface extending ICommonCacheService for network-backed caches.                                        |
| [IDistributedCacheService.Exists.cs](DistributedCacheService/IDistributedCacheService.Exists.cs) | Partial interface defining Exists operation (distributed-only) with IExistsHandler, ExistsInput record (key), and ExistsOutput record (bool). |
