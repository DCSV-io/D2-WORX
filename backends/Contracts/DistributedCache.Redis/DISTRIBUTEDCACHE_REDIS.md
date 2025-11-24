# DistributedCache.Redis

Redis-backed distributed caching implementation with JSON and protobuf binary serialization. Supports cross-instance cache sharing with comprehensive error handling and observability.

## Files

| File Name                       | Description                                                                                                                                     |
|---------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| [Get.cs](Handlers/Get.cs)       | Handler retrieving values from Redis, automatically deserializes JSON or protobuf binary based on type, handles connection failures gracefully. |
| [Set.cs](Handlers/Set.cs)       | Handler serializing values to JSON or protobuf binary and storing in Redis with optional TTL expiration.                                        |
| [Remove.cs](Handlers/Remove.cs) | Handler deleting keys from Redis with graceful error handling.                                                                                  |
| [Exists.cs](Handlers/Exists.cs) | Handler checking key existence in Redis without retrieving value, useful for cache presence validation.                                         |
| [Extensions.cs](Extensions.cs)  | DI extension methods registering Redis connection multiplexer and distributed cache handlers.                                                   |
