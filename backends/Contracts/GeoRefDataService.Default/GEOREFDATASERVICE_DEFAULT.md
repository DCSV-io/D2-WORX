# GeoRefDataService.Default

Default implementation of IGeoRefDataService with multi-tier caching strategy. Orchestrates georeference data retrieval across memory, Redis, and disk with automatic cache population and fallback handling.

## Files

| File Name                        | Description                                                                                                                      |
|----------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| [Get.cs](Handlers/Get.cs)        | Main handler orchestrating multi-tier retrieval with memory → Redis → disk fallback and retry logic on failures.                |
| [GetFromMem.cs](Handlers/GetFromMem.cs) | Handler retrieving georeference data from in-memory cache, returns NotFound if not cached.                                       |
| [GetFromDist.cs](Handlers/GetFromDist.cs) | Handler retrieving georeference data from Redis distributed cache using protobuf binary serialization.                           |
| [GetFromDisk.cs](Handlers/GetFromDisk.cs) | Handler retrieving georeference data from local file storage, reads protobuf binary format from configurable path.               |
| [SetInMem.cs](Handlers/SetInMem.cs) | Handler storing georeference data in in-memory cache for fast subsequent access.                                                 |
| [SetOnDisk.cs](Handlers/SetOnDisk.cs) | Handler persisting georeference data to local file storage as protobuf binary, creates directory if needed.                      |
| [ReqUpdate.cs](Handlers/ReqUpdate.cs) | Handler requesting georeference data update from Geo service via gRPC, used when all caches miss.                                |
| [Extensions.cs](Extensions.cs)   | DI extension methods providing AddGeoRefDataConsumer (with gRPC client) and AddGeoRefDataProvider (without Get/ReqUpdate).       |
