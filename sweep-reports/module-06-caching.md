### Module 6: Caching (Memory + Redis)

**Files reviewed**: 38 files, 2344 lines of source + test code

**Source files (680 lines)**:

- `implementations/caching/in-memory/default/src/memory-cache-store.ts` (83 lines)
- `implementations/caching/in-memory/default/src/index.ts` (14 lines)
- `implementations/caching/in-memory/default/src/service-keys.ts` (43 lines)
- `implementations/caching/in-memory/default/src/handlers/r/get.ts` (28 lines)
- `implementations/caching/in-memory/default/src/handlers/r/get-many.ts` (43 lines)
- `implementations/caching/in-memory/default/src/handlers/u/set.ts` (23 lines)
- `implementations/caching/in-memory/default/src/handlers/u/set-many.ts` (25 lines)
- `implementations/caching/in-memory/default/src/handlers/d/remove.ts` (21 lines)
- `implementations/caching/distributed/redis/src/serialization.ts` (16 lines)
- `implementations/caching/distributed/redis/src/index.ts` (20 lines)
- `implementations/caching/distributed/redis/src/service-keys.ts` (61 lines)
- `implementations/caching/distributed/redis/src/handlers/r/get.ts` (46 lines)
- `implementations/caching/distributed/redis/src/handlers/r/get-ttl.ts` (32 lines)
- `implementations/caching/distributed/redis/src/handlers/r/exists.ts` (29 lines)
- `implementations/caching/distributed/redis/src/handlers/u/set.ts` (50 lines)
- `implementations/caching/distributed/redis/src/handlers/u/increment.ts` (37 lines)
- `implementations/caching/distributed/redis/src/handlers/d/remove.ts` (29 lines)
- `implementations/caching/distributed/redis/src/handlers/c/set-nx.ts` (51 lines)
- `implementations/caching/distributed/redis/src/handlers/q/ping.ts` (29 lines)

**Test files (1664 lines)**:

- Unit: `memory-cache-store.test.ts` (93), `get.test.ts` (61), `get-many.test.ts` (63), `set.test.ts` (48), `set-many.test.ts` (52), `remove.test.ts` (40), `lru.test.ts` (180), `falsy-values.test.ts` (113)
- Unit: `redis-error-paths.test.ts` (101), `serialization.test.ts` (53)
- Integration: `get.test.ts` (94), `set.test.ts` (68), `remove.test.ts` (34), `exists.test.ts` (35), `get-ttl.test.ts` (47), `increment.test.ts` (56), `redis-test-helpers.ts` (41)
- Interface: `distributed-cache.test.ts` (266), `in-memory-cache.test.ts` (219)

---

**Assumptions documented**:

1. **TTL is in milliseconds** — Both packages use `expirationMs` consistently. Redis uses `PX` (millisecond precision) and `pttl`/`pexpire`.
2. **LRU eviction is synchronous** — `MemoryCacheStore` eviction happens synchronously during `set()` (Map deletion + re-insertion).
3. **Lazy TTL eviction only** — Expired entries are not proactively cleaned. They linger until accessed via `get()` or `has()`. CACHE_MEMORY.md mentions "periodic sweep" but none is implemented.
4. **Redis increment+expire is non-atomic** — `incrby` then `pexpire` are two separate commands.
5. **`undefined` is never a legitimate cache value** — `MemoryCacheStore.get()` returns `undefined` as "not found" sentinel.
6. **JSON is the default serializer** — `JsonCacheSerializer` is used by default. Non-JSON-safe values require custom serializer.
7. **Callers validate expirationMs** — No validation for zero, negative, or non-integer values.
8. **Redis connection errors are the only anticipated failure mode** — All handlers catch all exceptions as `SERVICE_UNAVAILABLE`.
9. **Single-threaded access to MemoryCacheStore** — No synchronization primitives.
10. **Map insertion order is stable** — LRU relies on V8's Map iteration order (per ECMA-262 spec).

---

**Findings**:

| #   | Severity | Category        | File:Line                                                           | Description                                                                                                                                                                                                                                                                                                                                     |
| --- | -------- | --------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Medium   | Bug             | `redis/handlers/u/increment.ts:22-25`                               | **Non-atomic increment + expire**: `incrby` and `pexpire` are two separate Redis commands. If process crashes between them, the key persists without TTL forever. This is the primary consumer of the rate limiter — a crash at the wrong moment leaves stale rate-limit counters that never expire. Should use a Redis pipeline or Lua script. |
| 2   | Medium   | Bug             | `redis/handlers/u/increment.ts:24-25`                               | **TTL reset on every increment**: When `expirationMs` is provided, `pexpire` resets TTL on every call, not just on key creation. For sliding-window rate limiting this is intentional, but for other use cases TTL keeps sliding forward. Interface does not document "set TTL only on creation" vs "reset TTL every time."                     |
| 3   | Medium   | Consistency     | `redis/handlers/r/get.ts:38-43` (and all 7 Redis handlers)          | **Overly broad error categorization**: All exceptions caught with `catch { }` (no error variable) and labeled `SERVICE_UNAVAILABLE` with "Unable to connect to Redis." A `WRONGTYPE` error, auth error, or timeout would all be reported identically. Error is discarded, making debugging harder. Pattern repeats in all 7 handlers.           |
| 4   | Low      | Bug             | `in-memory/handlers/r/get-many.ts:25-30`                            | **Stored `undefined` treated as cache miss**: `if (value !== undefined)` means stored `undefined` would be silently excluded from results. Same issue in `get.ts:22-24`.                                                                                                                                                                        |
| 5   | Low      | Performance     | `in-memory/memory-cache-store.ts:38-44`                             | **Expired entries consume memory until accessed**: No background sweep. A store with 10,000 expired entries still reports `size === 10000`. LRU eviction evicts by insertion order, not expiration, so expired entries could survive while live ones get evicted.                                                                               |
| 6   | Low      | Bug             | `in-memory/memory-cache-store.ts:52-58`                             | **LRU eviction does not skip expired entries**: When at capacity, evicts oldest entry even if newer expired entries exist. Expired entries remain while live entries get evicted. Practical impact low with consistent TTLs.                                                                                                                    |
| 7   | Low      | Security        | `redis/serialization.ts:13-14`                                      | **Unvalidated JSON deserialization**: `JSON.parse(raw.toString("utf-8")) as T` — unsafe cast. Mitigated by internal Redis access.                                                                                                                                                                                                               |
| 8   | Low      | Security        | `in-memory/memory-cache-store.ts:48` + `redis/handlers/u/set.ts:22` | **No key validation/sanitization**: Cache keys are arbitrary strings. For Redis, keys with newlines or null bytes could cause unexpected behavior (though ioredis handles safely).                                                                                                                                                              |
| 9   | Low      | Consistency     | Interface design                                                    | **Different miss semantics**: In-memory `GetOutput<T>.value` is `TValue` (non-optional) with `notFound()` on miss. Redis interface declares `TValue                                                                                                                                                                                             | undefined`but implementation also returns`notFound()`. Misleading for new implementors. |
| 10  | Low      | Maintainability | `redis/handlers/*.ts`                                               | **Boilerplate repetition**: Every Redis handler has identical 6-line `catch` block returning `SERVICE_UNAVAILABLE`. Repeated 7 times. A shared utility would reduce duplication.                                                                                                                                                                |
| 11  | Low      | Maintainability | `CACHE_MEMORY.md:20`                                                | **Documentation claims "periodic sweep" that does not exist**: Should be updated to remove mention.                                                                                                                                                                                                                                             |
| 12  | Low      | Consistency     | `in-memory/handlers/r/get-many.ts:33-36`                            | **Empty keys array returns NOT_FOUND**: When `input.keys` is empty, `foundCount` is 0, returning `NOT_FOUND`. May surprise callers.                                                                                                                                                                                                             |
| 13  | Low      | Performance     | `redis/handlers/u/increment.ts:22-25`                               | **Two round trips for increment with TTL**: `incrby` then `pexpire` could be pipelined into a single round trip, halving latency. Important for rate limiting (primary consumer).                                                                                                                                                               |
| 14  | Low      | Consistency     | Service keys design                                                 | **Memory cache uses factory functions for all keys; Redis uses mix of constants and factory functions.** Minor pattern divergence.                                                                                                                                                                                                              |
| 15  | Low      | Elegance        | `in-memory/memory-cache-store.ts:68-78`                             | **`has()` does not promote LRU**: Checking existence doesn't promote to MRU position (no delete + re-insert). Deliberate but undocumented.                                                                                                                                                                                                      |

---

**Tests to add**:

- [ ] Integration test for `SetNx` handler (only tested indirectly via idempotency)
- [ ] Integration test for `PingCache` handler (no test exists)
- [ ] Unit test for `SetNx` error paths (serialization failure, Redis down)
- [ ] Unit test for `PingCache` Redis error path
- [ ] `expirationMs: 0` behavior on both memory and Redis Set/SetNx/Increment
- [ ] `expirationMs: -1` or negative values
- [ ] `Increment` with `amount: 0`
- [ ] `Increment` when existing Redis key holds non-numeric value (WRONGTYPE error)
- [ ] `GetMany` with duplicate keys in input array
- [ ] `MemoryCacheStore` with `maxEntries: 0`
- [ ] `has()` does NOT promote LRU position (document design choice)

**Tests to remove**:

- (None — all existing tests are valid)
