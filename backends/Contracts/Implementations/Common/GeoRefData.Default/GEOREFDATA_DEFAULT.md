# GeoRefData.Default

Default implementation of geographic reference data service with multi-tier caching strategy (memory → Redis → disk), gRPC client integration, and messaging subscription for cache invalidation.

## Files

| File Name                      | Description                                                                                                                                    |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| [Extensions.cs](Extensions.cs) | DI extension method AddGeoRefDataConsumer registering gRPC client, cache handlers, and messaging handlers (excludes MassTransit registration). |

## CQRS

### Handlers

#### C (Commands)

| File Name                                          | Description                                                                                           |
|----------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| [ReqUpdate.cs](CQRS/Handlers/C/ReqUpdate.cs)       | Handler requesting reference data update from Geo service via gRPC when all caches miss.              |
| [SetInDist.cs](CQRS/Handlers/C/SetInDist.cs)       | Handler storing reference data in Redis distributed cache using protobuf binary serialization.        |
| [SetInMem.cs](CQRS/Handlers/C/SetInMem.cs)         | Handler storing reference data in in-memory cache for fast subsequent access.                         |
| [SetOnDisk.cs](CQRS/Handlers/C/SetOnDisk.cs)       | Handler persisting reference data to local file storage as protobuf binary for restart resilience.    |

#### Q (Queries)

| File Name                                          | Description                                                                                           |
|----------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| [GetFromDisk.cs](CQRS/Handlers/Q/GetFromDisk.cs)   | Handler retrieving reference data from local file storage using protobuf binary deserialization.      |
| [GetFromDist.cs](CQRS/Handlers/Q/GetFromDist.cs)   | Handler retrieving reference data from Redis distributed cache using protobuf binary serialization.   |
| [GetFromMem.cs](CQRS/Handlers/Q/GetFromMem.cs)     | Handler retrieving reference data from in-memory cache, returns NotFound if not cached.               |

#### U (Utilities)

No utility handlers.

#### X (Complex)

| File Name                        | Description                                                                                                                     |
|----------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| [Get.cs](CQRS/Handlers/X/Get.cs) | Main orchestrator implementing multi-tier retrieval with memory → Redis → disk fallback and automatic cache population on miss. |

## Messaging

### Handlers

#### Pub (Publishers)

No publisher handlers - this service subscribes only.

#### Sub (Subscribers)

| File Name                                       | Description                                                                                                         |
|-------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| [Updated.cs](Messaging/Handlers/Sub/Updated.cs) | Handler processing GeoRefDataUpdated messages by proactively fetching from Redis and populating memory/disk caches. |

### MT (MassTransit)

#### Consumers

| File Name                                                       | Description                                                                                                            |
|-----------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| [UpdatedConsumer.cs](Messaging/MT/Consumers/UpdatedConsumer.cs) | MassTransit consumer adapter delegating GeoRefDataUpdated messages to Updated handler with error handling and logging. |

#### Publishers

No publishers - MassTransit registration happens in service Infra layers, not this shared library.
