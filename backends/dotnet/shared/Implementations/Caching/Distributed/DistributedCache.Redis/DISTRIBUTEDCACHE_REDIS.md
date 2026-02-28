# DistributedCache.Redis

Redis distributed cache implementation using StackExchange.Redis with handler-based CRUD operations for cache management.

## Files

| File Name                      | Description                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [Extensions.cs](Extensions.cs) | DI extension method AddRedisCaching registering IConnectionMultiplexer and distributed cache handlers. |

## Handlers

### C (Create)

| File Name                                   | Description                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [AcquireLock.cs](Handlers/C/AcquireLock.cs) | Handler for acquiring a distributed lock via SET NX PX (plain string, no serialization). |

### D (Delete)

| File Name                                   | Description                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Remove.cs](Handlers/D/Remove.cs)           | Handler for removing data from Redis by key.                                       |
| [ReleaseLock.cs](Handlers/D/ReleaseLock.cs) | Handler for safely releasing a distributed lock via Lua compare-and-delete script. |

### R (Read)

| File Name                         | Description                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| [Get.cs](Handlers/R/Get.cs)       | Handler for retrieving generic typed data from Redis using protobuf binary deserialization. |
| [Exists.cs](Handlers/R/Exists.cs) | Handler for checking if a key exists in Redis without retrieving the value.                 |
| [GetTtl.cs](Handlers/R/GetTtl.cs) | Handler for retrieving the remaining time-to-live of a key in Redis.                        |

### U (Update)

| File Name                               | Description                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [Set.cs](Handlers/U/Set.cs)             | Handler for storing (upsert) generic typed data in Redis using protobuf binary serialization with optional TTL. |
| [Increment.cs](Handlers/U/Increment.cs) | Handler for atomically incrementing a counter in Redis with optional TTL for new keys.                          |
