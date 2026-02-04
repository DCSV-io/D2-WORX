# DistributedCache.Redis

Redis distributed cache implementation using StackExchange.Redis with handler-based CRUD operations for cache management.

## Files

| File Name                      | Description                                                                                            |
|--------------------------------|--------------------------------------------------------------------------------------------------------|
| [Extensions.cs](Extensions.cs) | DI extension method AddRedisCaching registering IConnectionMultiplexer and distributed cache handlers. |

## Handlers

### C (Create)

No create handlers - Redis Set operation is upsert (create or update).

### D (Delete)

| File Name                         | Description                                  |
|-----------------------------------|----------------------------------------------|
| [Remove.cs](Handlers/D/Remove.cs) | Handler for removing data from Redis by key. |

### R (Read)

| File Name                         | Description                                                                                 |
|-----------------------------------|---------------------------------------------------------------------------------------------|
| [Get.cs](Handlers/R/Get.cs)       | Handler for retrieving generic typed data from Redis using protobuf binary deserialization. |
| [Exists.cs](Handlers/R/Exists.cs) | Handler for checking if a key exists in Redis without retrieving the value.                 |

### U (Update)

| File Name                   | Description                                                                                                     |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------|
| [Set.cs](Handlers/U/Set.cs) | Handler for storing (upsert) generic typed data in Redis using protobuf binary serialization with optional TTL. |
