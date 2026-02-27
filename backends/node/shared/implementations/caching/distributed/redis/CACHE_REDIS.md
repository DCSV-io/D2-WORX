# @d2/cache-redis

Redis distributed cache implementation via ioredis. Mirrors `DistributedCache.Redis` in .NET. Layer 3.

## Files

| File Name                                              | Description                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [serialization.ts](src/serialization.ts)               | `ICacheSerializer` interface + `JsonCacheSerializer` default implementation.               |
| [handlers/r/get.ts](src/handlers/r/get.ts)             | `Get` handler — retrieve value with deserialization.                                       |
| [handlers/r/exists.ts](src/handlers/r/exists.ts)       | `Exists` handler — check key existence.                                                    |
| [handlers/r/get-ttl.ts](src/handlers/r/get-ttl.ts)     | `GetTtl` handler — get remaining TTL in milliseconds.                                      |
| [handlers/u/set.ts](src/handlers/u/set.ts)             | `Set` handler — store value with optional TTL and serialization.                           |
| [handlers/u/increment.ts](src/handlers/u/increment.ts) | `Increment` handler — atomic counter increment with optional TTL.                          |
| [handlers/c/set-nx.ts](src/handlers/c/set-nx.ts)             | `SetNx` handler — SET if Not eXists with optional TTL (for idempotency locks).             |
| [handlers/c/acquire-lock.ts](src/handlers/c/acquire-lock.ts) | `AcquireLock` handler — distributed lock acquire via SET NX PX (plain string, no serializer). |
| [handlers/r/ping.ts](src/handlers/r/ping.ts)           | `PingCache` handler — verify Redis connectivity and measure latency.                       |
| [handlers/d/remove.ts](src/handlers/d/remove.ts)             | `Remove` handler — delete key.                                                             |
| [handlers/d/release-lock.ts](src/handlers/d/release-lock.ts) | `ReleaseLock` handler — safe lock release via Lua compare-and-delete script.               |
| [service-keys.ts](src/service-keys.ts)                 | ServiceKeys for Redis client and cache handler DI registration (IRedisKey, ICachePingKey). |
| [redis-error-result.ts](src/redis-error-result.ts)     | Shared Redis error handling utility used by all handlers.                                  |
| [index.ts](src/index.ts)                               | Barrel re-export of all handlers + `ICacheSerializer` + `JsonCacheSerializer`.             |

## Serialization

Pluggable serialization via `ICacheSerializer` interface:

- **`JsonCacheSerializer`** (default) — JSON stringify/parse for general-purpose caching
- **Custom serializers** — e.g., `GeoRefDataSerializer` in `@d2/geo-client` for binary protobuf

Serializer is injected via constructor on handlers that need it (Get, Set).

## Handler Structure

Follows TLC folder convention matching `@d2/interfaces`:

```
handlers/
├── c/          # Create: SetNx, AcquireLock
├── r/          # Read: Get, Exists, GetTtl
├── u/          # Update: Set, Increment
├── d/          # Delete: Remove, ReleaseLock
└── q/          # Query: PingCache
```

## .NET Equivalent

`DistributedCache.Redis` — 9 handlers (Get, Set, SetNx, Remove, Exists, GetTtl, Increment, AcquireLock, ReleaseLock) using `IConnectionMultiplexer`. Node.js version uses `ioredis` directly.
