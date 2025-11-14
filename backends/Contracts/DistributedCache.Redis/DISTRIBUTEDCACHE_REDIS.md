# DistributedCache.Redis

Redis-backed distributed caching implementation with JSON serialization. Supports cross-instance cache sharing with comprehensive error handling and observability.

## Files

| File Name                                                          | Description                                                                                                               |
|--------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| [RedisDistributedCacheService.cs](RedisDistributedCacheService.cs) | Service facade implementing IDistributedCacheService using StackExchange.Redis connection multiplexer.                    |
| [Get.cs](Handlers/Get.cs)                                          | Handler retrieving and deserializing JSON values from Redis, handles connection failures with ServiceUnavailable results. |
| [Set.cs](Handlers/Set.cs)                                          | Handler serializing values to JSON byte arrays and storing in Redis with optional TTL expiration.                         |
| [Remove.cs](Handlers/Remove.cs)                                    | Handler deleting keys from Redis, handles network errors gracefully.                                                      |
| [Exists.cs](Handlers/Exists.cs)                                    | Handler checking key existence in Redis without retrieving value, useful for cache presence validation.                   |
| [Extensions.cs](Extensions.cs)                                     | DI extension methods for registering Redis distributed caching services.                                                  |
