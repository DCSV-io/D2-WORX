# Interfaces

Service interface contracts defining standard patterns for caching, handlers, and cross-cutting concerns. Enables dependency inversion and testability across microservices.

## Files

| File Name                                                                                        | Description                                                                                                                    |
|--------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| [ICommonCacheService.cs](CommonCacheService/ICommonCacheService.cs)                              | Base partial interface for common caching operations shared across different cache implementations.                            |
| [ICommonCacheService.Get.cs](CommonCacheService/ICommonCacheService.Get.cs)                      | Partial interface defining Get operation with IGetHandler, GetInput record (key), and GetOutput record (nullable value).       |
| [ICommonCacheService.Set.cs](CommonCacheService/ICommonCacheService.Set.cs)                      | Partial interface defining Set operation with ISetHandler, SetInput record (key, value, optional expiration), and SetOutput.   |
| [ICommonCacheService.Remove.cs](CommonCacheService/ICommonCacheService.Remove.cs)                | Partial interface defining Remove operation with IRemoveHandler, RemoveInput record (key), and RemoveOutput record.            |
| [IMemoryCacheService.cs](MemoryCacheService/IMemoryCacheService.cs)                              | In-memory caching service contract extending ICommonCacheService.                                                              |
| [IDistributedCacheService.cs](DistributedCacheService/IDistributedCacheService.cs)               | Distributed caching service partial interface extending ICommonCacheService.                                                   |
| [IDistributedCacheService.Exists.cs](DistributedCacheService/IDistributedCacheService.Exists.cs) | Partial interface defining Exists operation with IExistsHandler, ExistsInput record (key), and ExistsOutput record (bool).     |
| [IGeoRefDataService.cs](GeoRefDataService/IGeoRefDataService.cs)                                 | Georeference data service partial interface for multi-tier data retrieval operations.                                          |
| [IGeoRefDataService.Get.cs](GeoRefDataService/IGeoRefDataService.Get.cs)                         | Partial interface defining Get operation with IGetHandler orchestrating retrieval across multiple sources.                     |
| [IGeoRefDataService.GetFromMem.cs](GeoRefDataService/IGeoRefDataService.GetFromMem.cs)           | Partial interface defining GetFromMem operation with IGetFromMemHandler for memory-based retrieval.                            |
| [IGeoRefDataService.GetFromDist.cs](GeoRefDataService/IGeoRefDataService.GetFromDist.cs)         | Partial interface defining GetFromDist operation with IGetFromDistHandler for distributed cache retrieval.                     |
| [IGeoRefDataService.GetFromDisk.cs](GeoRefDataService/IGeoRefDataService.GetFromDisk.cs)         | Partial interface defining GetFromDisk operation with IGetFromDiskHandler for persistent storage retrieval.                    |
| [IGeoRefDataService.SetInMem.cs](GeoRefDataService/IGeoRefDataService.SetInMem.cs)               | Partial interface defining SetInMem operation with ISetInMemHandler for memory-based storage.                                  |
| [IGeoRefDataService.SetOnDisk.cs](GeoRefDataService/IGeoRefDataService.SetOnDisk.cs)             | Partial interface defining SetOnDisk operation with ISetOnDiskHandler for persistent storage.                                  |
| [IGeoRefDataService.ReqUpdate.cs](GeoRefDataService/IGeoRefDataService.ReqUpdate.cs)             | Partial interface defining ReqUpdate operation with IReqUpdateHandler for requesting external data updates.                    |
