### Module 21: .NET Implementations

**Files reviewed**: 42 .cs source files across 8 projects (excluding auto-generated obj/ files)

**Projects**:
- `Caching/InMemory/InMemoryCache.Default/` (6 files: Extensions.cs + 5 handlers)
- `Caching/Distributed/DistributedCache.Redis/` (9 files: Extensions.cs + 8 handlers)
- `Repository/Batch/Batch.Pg/` (4 files: BatchOptions, BatchQuery, D2ResultExtensions, Extensions)
- `Repository/Transactions/Transactions.Pg/` (4 files: Extensions.cs + 3 transaction handlers)
- `Messaging/Messaging.RabbitMQ/` (5 files: AmqpConventions, ProtoPublisher, ProtoConsumer, Extensions, Ping)
- `Middleware/RequestEnrichment.Default/` (7 files: IRequestInfo, RequestInfo, IpResolver, FingerprintBuilder, Options, Middleware, Extensions)
- `Middleware/RateLimit.Default/` (7 files: IRateLimit, IRateLimit.Check, RateLimitDimension, Options, Middleware, Check handler, Extensions)
- `Middleware/Idempotency.Default/` (8 files: CachedResponse, Options, State, IIdempotency, IIdempotency.Check, Middleware, Check handler, Extensions)

**Documentation reviewed**: REQUEST_ENRICHMENT.md, RATE_LIMIT.md, IDEMPOTENCY.md

---

**Assumptions documented**:

1. **Redis connectivity is resilient** -- All Redis handlers assume `AbortOnConnectFail = false` (set in Extensions.cs) and return `SERVICE_UNAVAILABLE` on `RedisException` rather than propagating the exception.
2. **Middleware pipeline ordering is enforced by the caller** -- Request enrichment must run before rate limiting, which must run before idempotency. No runtime enforcement.
3. **IMemoryCache is registered** -- InMemoryCache.Default calls `services.AddMemoryCache()` which assumes Microsoft.Extensions.Caching.Memory is available.
4. **Single IConnectionMultiplexer per app** -- Redis is registered as singleton. All handlers share one multiplexer.
5. **Single RabbitMQ IConnection per app** -- Registered as singleton via blocking `.GetAwaiter().GetResult()` in factory.
6. **DbContext is scoped** -- Transaction handlers inject `DbContext` directly (not generic), assuming it is registered as scoped.
7. **WhoIs handler (IComplex.IFindWhoIsHandler) is registered** -- RequestEnrichmentMiddleware injects it per-request.
8. **Protobuf messages implement IMessage** -- Redis Get/Set use runtime type checking (`IsAssignableTo(typeof(IMessage))`) to choose proto vs JSON serialization.
9. **Protobuf Parser property is public static** -- Redis Get uses reflection to find `Parser` property for deserialization.
10. **Rate limit check is fail-open** -- Any Redis error in any dimension causes that dimension (or entire check) to pass.
11. **Idempotency is fail-open** -- Any Redis error during SET NX or GET causes the request to proceed (potential duplicate).
12. **IRequestInfo is set on HttpContext.Features** -- Both rate limit and idempotency middleware read from Features.
13. **Idempotency key must be UUID** -- Validated via `Guid.TryParse`.
14. **ProtoPublisher always declares fanout exchange** -- Even for command exchanges (naming says "CommandExchange" but `PublishAsync` always declares `ExchangeType.Fanout`).
15. **ProtoConsumer creates new channel per publish** -- ProtoPublisher creates `await using var channel` per call (creates and disposes a channel each time).
16. **Batch query expression building uses Contains** -- Relies on EF Core translating `Enumerable.Contains` to SQL `IN` clause.
17. **Country whitelist comparison is case-sensitive** -- `WhitelistedCountryCodes.Contains(requestInfo.CountryCode)` uses default string comparison.

---

**Findings**:

| #  | Severity | Category             | File:Line                                                                                                | Description                                                                                                                                                                                                                                                                                                                                                                                                |
|----|----------|----------------------|----------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | High     | Performance          | `Messaging.RabbitMQ/ProtoPublisher.cs:70`                                                                | **Channel created and disposed per publish**. Each call to `PublishAsync` creates a new channel (`await using var channel = await r_connection.CreateChannelAsync`). RabbitMQ channels are relatively expensive to create/destroy. A persistent channel (or pooled channels) should be used for high-throughput scenarios. The Node.js `MessageBus.createPublisher` reuses a persistent publisher connection. |
| 2  | High     | Performance          | `Messaging.RabbitMQ/ProtoPublisher.cs:72-77`                                                             | **Exchange declared on every publish**. `ExchangeDeclareAsync` is called every time `PublishAsync` is invoked. While idempotent on the broker, it adds unnecessary network round-trips per message. Should be done once at startup or cached.                                                                                                                                                               |
| 3  | Medium   | Bug                  | `Messaging.RabbitMQ/ProtoPublisher.cs:72-76`                                                             | **Exchange type hardcoded to Fanout**. `PublishAsync` always declares `ExchangeType.Fanout`, but `AmqpConventions.CommandExchange` implies topic exchanges for commands. If `PublishAsync` is used with a command exchange and routing key, the exchange type mismatch could cause issues (redeclare with different type throws).                                                                             |
| 4  | Medium   | Cross-Platform Parity| `RequestEnrichment.Default/IRequestInfo.cs` vs Node `i-request-info.ts`                                  | **Missing `IsTrustedService` on Node.js interface**. The .NET `IRequestInfo` has `IsTrustedService` property (line 63) used for S2S trust bypass. The Node.js `IRequestInfo` interface has no equivalent property. The .NET rate limiter checks `requestInfo.IsTrustedService` for early bypass; the Node.js rate limiter does not have this check. This is a feature gap for Node.js service-to-service calls. |
| 5  | Medium   | Cross-Platform Parity| `RateLimit.Default/Handlers/Check.cs:91-94` vs Node `check.ts`                                           | **Trusted service bypass exists only in .NET**. The .NET Check handler has `if (requestInfo.IsTrustedService) return Ok(not-blocked)`. The Node.js Check handler has no equivalent. Per CLAUDE.md: "Trusted services bypass all dimensions (early return in Check handler)."                                                                                                                                |
| 6  | Medium   | Consistency          | `RateLimit.Default/Handlers/Check.cs:250`                                                                | **Weight calculation differs subtly from Node.js**. .NET uses `now.Second + (now.Millisecond / 1000.0)` (integer division risk mitigated by 1000.0). Node.js uses `now.getUTCSeconds() + now.getUTCMilliseconds() / 1000`. Both are equivalent, but .NET uses local `Second`/`Millisecond` while `GetWindowId` uses UTC-formatted strings. Since `DateTime.UtcNow` is used, this is correct but fragile -- if someone changes to `DateTime.Now`, the weight calc would use local time while window IDs use UTC. |
| 7  | Medium   | Performance          | `DistributedCache.Redis/Handlers/R/Get.cs:121-148`                                                       | **Protobuf deserialization uses reflection**. `ParseProtobuf` uses `GetProperty("Parser")` + `GetMethod("ParseFrom")` + `Invoke` per call. This is significantly slower than a compiled approach. Consider caching the `MethodInfo` per type in a `ConcurrentDictionary<Type, Func<byte[], TValue>>` or using `Google.Protobuf.MessageParser<T>` directly.                                                |
| 8  | Medium   | Performance          | `DistributedCache.Redis/Handlers/U/Increment.cs:52-58`                                                   | **Increment + Expire is not atomic**. `StringIncrementAsync` followed by `KeyExpireAsync` in two separate commands. A MULTI/EXEC or Lua script would be atomic. If the process crashes between the two calls, the key persists without TTL. Node.js ioredis `incrby` + `pexpire` has the same issue -- both platforms are consistent but both have the race condition.                                      |
| 9  | Low      | Consistency          | `Messaging.RabbitMQ/Extensions.cs:46-47`                                                                 | **Blocking async in DI factory**. `factory.CreateConnectionAsync().GetAwaiter().GetResult()` synchronously blocks. While common in DI registration, it can deadlock under certain SynchronizationContexts. The Node.js side uses proper async connection with `await bus.waitForConnection()`.                                                                                                              |
| 10 | Low      | Consistency          | `Messaging.RabbitMQ/ProtoConsumer.cs:101-124`                                                            | **Consumer requeues on all errors**. `BasicNackAsync(..., requeue: true)` will requeue every failed message, potentially causing infinite retry loops for poison messages. The Node.js `subscribeEnriched` uses `requeue: false` for handler control. The basic `subscribe` lets rabbitmq-client handle requeue policy.                                                                                      |
| 11 | Low      | Cross-Platform Parity| `Messaging.RabbitMQ/` vs Node `@d2/messaging`                                                            | **Structural asymmetry**. .NET uses separate `ProtoPublisher` (per-call channel) and `ProtoConsumer<T>` (static factory). Node.js uses unified `MessageBus` with `createPublisher()` + `subscribe()`/`subscribeEnriched()`. The .NET approach is lower-level and less abstracted. The Node.js MessageBus also supports topology declaration, publisher confirms, and max attempts -- none present in .NET. |
| 12 | Low      | Consistency          | `InMemoryCache.Default/Handlers/U/SetMany.cs:50-59`                                                     | **Shared MemoryCacheEntryOptions across batch**. A single `MemoryCacheEntryOptions` instance is created and reused for all entries in the batch. While `MemoryCacheEntryOptions` is not documented as thread-unsafe, some implementations could mutate it during `Set`. The single `Set` handler (line 53 of Set.cs) does not share options objects. Minor inconsistency in approach.                        |
| 13 | Low      | Elegance             | `Repository/Batch/Batch.Pg/BatchQuery.cs:169`                                                            | **KeySelector compiled per `ToDictionaryAsync` call**. `r_keySelector.Compile()` is called every time `ToDictionaryAsync` or `GetMissingIdsAsync` is invoked. This expression compilation is expensive. Consider caching the compiled delegate in a `Lazy<Func<TEntity, TKey>>`.                                                                                                                           |
| 14 | Low      | Consistency          | `Repository/Transactions/Transactions.Pg/Transactions/Begin.cs:21`                                       | **BaseHandler self-type is `Begin` not `H`**. Transaction handlers use `BaseHandler<Begin, I, O>` while caching/middleware handlers use the interface alias `H` as the self-type parameter (e.g., `BaseHandler<H, I, O>`). This is an inconsistent pattern across the codebase.                                                                                                                            |
| 15 | Low      | Maintainability      | `RateLimit.Default/Handlers/Check.cs:130`                                                                | **Country whitelist comparison is case-sensitive**. `r_options.WhitelistedCountryCodes.Contains(requestInfo.CountryCode)` uses default `List<string>.Contains` which is ordinal. If WhoIs data returns "us" instead of "US", the whitelist would not match. The Node.js version uses the same pattern (`includes()`). Both assume uppercase codes from WhoIs, which is true for ISO 3166-1 alpha-2.          |
| 16 | Low      | Maintainability      | `RateLimit.Default/RateLimitMiddleware.cs:114-117`                                                       | **JsonSerializerOptions created per-request**. A new `JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }` is allocated on every rate-limited request. Should be a static field. Same issue in `IdempotencyMiddleware.cs:111-113` and `:162-164`.                                                                                                                                  |
| 17 | Low      | Elegance             | `DistributedCache.Redis/Handlers/Q/Ping.cs` and `Messaging.RabbitMQ/Handlers/Q/Ping.cs`                  | **Ping handlers live in Q/ (Query) folders but are registered under IRead interface**. The `Ping` file path says `Handlers/Q/` but the interface namespace says `Handlers.R.IRead.IPingHandler`. The Q/ folder convention (read-only) is consistent with the handler being a query, but the interface path says R/ (read). Minor naming inconsistency.                                                      |
| 18 | Low      | Cross-Platform Parity| `InMemoryCache.Default/` vs Node `@d2/cache-memory`                                                      | **No LRU eviction in .NET**. The .NET in-memory cache uses `Microsoft.Extensions.Caching.Memory.IMemoryCache` which does not have LRU by default (it uses size-based eviction via `SizeLimit` which is not configured here). The Node.js `MemoryCacheStore` implements explicit LRU with `maxEntries: 10_000`. The .NET cache could grow unbounded.                                                        |
| 19 | Low      | Cross-Platform Parity| `Idempotency.Default/IdempotencyOptions.cs` vs Node `idempotency-options.ts`                              | **Node.js idempotency options lack `ApplicableMethods` and `CacheErrorResponses`**. The .NET `IdempotencyOptions` has `ApplicableMethods` (POST/PUT/PATCH/DELETE) and `CacheErrorResponses` (default false). The Node.js `IdempotencyOptions` only has `cacheTtlMs`, `inFlightTtlMs`, `maxBodySizeBytes`. This is partially because Node's `checkIdempotency` is framework-agnostic (method filtering is done by the framework consumer). |
| 20 | Low      | Maintainability      | `Repository/Transactions/Transactions.Pg/Transactions/Begin.cs:36`                                       | **Transaction handlers inject abstract `DbContext`**. `Begin`, `Commit`, `Rollback` all inject `DbContext` directly. This works but means the DI container must register the concrete DbContext as its base type too, or the service must register `DbContext` itself. Services using a derived context (e.g., `GeoDbContext`) need to also register `services.AddScoped<DbContext>(sp => sp.GetRequired<GeoDbContext>())`. |
| 21 | Low      | Cross-Platform Parity| `Messaging.RabbitMQ/ProtoConsumer.cs:97`                                                                 | **Prefetch count hardcoded to 1**. `BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false)` is fixed. Node.js `subscribe` allows configurable `prefetchCount` via `config.prefetchCount`. The .NET consumer has no way to configure this.                                                                                                                                                        |
| 22 | Low      | Cross-Platform Parity| `DistributedCache.Redis/Extensions.cs:48-53`                                                              | **Redis connection options differ**. .NET uses `ConfigurationOptions.Parse(connectionString)` with `AbortOnConnectFail = false`. Node.js uses ioredis which has different default behavior (auto-reconnect). Both are resilient but through different mechanisms. The .NET side does not set `ConnectRetry` or `ReconnectRetryPolicy` explicitly.                                                           |

---

**Positive observations**:

1. **Excellent convention adherence** -- All 42 files have license headers, use correct field prefixes (`r_` for readonly), proper XML documentation, and follow the BaseHandler pattern consistently.
2. **D2Result pattern used everywhere** -- All handlers return `D2Result<T?>`, including `NotFound()`, `SomeFound()`, `Ok()` semantics in GetMany.
3. **PII protection is thorough** -- Rate limit and request enrichment middleware explicitly avoid logging client IPs, fingerprints, and other PII. Comments document this design decision.
4. **Fail-open pattern is consistent** -- Rate limiting, idempotency, and request enrichment all fail open on Redis/external service errors. This matches the documented architecture.
5. **Options pattern used correctly** -- All middleware packages use `IOptions<T>` with `services.Configure<T>(config.GetSection(...))`.
6. **Partial interface pattern** -- Rate limit and idempotency both use the partial interface extension pattern correctly (IRateLimit.cs + IRateLimit.Check.cs).
7. **Handler category placement is correct** -- Cache Read/Update/Delete/Create operations are in R/U/D/C folders. Idempotency Check is in X/ (Complex). Transaction Begin/Commit/Rollback are appropriately categorized.
8. **Batch.Pg is well-designed** -- BatchQuery supports `ToListAsync`, `ToDictionaryAsync`, `ToAsyncEnumerable`, `GetMissingIdsAsync`, and `ToD2ResultAsync`. The D2ResultExtensions correctly map to `Ok`/`SomeFound`/`NotFound`.
9. **C# 14 extension members** -- All Extension.cs files use the new C# 14 `extension(T)` syntax consistently.
10. **Cross-platform algorithm parity** -- Rate limit sliding window algorithm, idempotency SET NX + GET pattern, fingerprint computation, and IP resolution priority chains are identical between .NET and Node.js.

---

**Tests to add**:
- [ ] RateLimit Check handler: test `IsTrustedService = true` bypasses all dimensions
- [ ] RateLimit Check handler: verify case-insensitive country code matching (or document that codes must be uppercase)
- [ ] ProtoPublisher: integration test verifying exchange type mismatch behavior (fanout vs topic)
- [ ] ProtoConsumer: test poison message behavior (infinite requeue loop)
- [ ] Redis Increment: test key without TTL when process crashes between INCR and EXPIRE
- [ ] BatchQuery: benchmark `ToDictionaryAsync` with many calls to verify expression compilation overhead
- [ ] Idempotency middleware: test response body exactly at `MaxBodySizeBytes` boundary
- [ ] Idempotency middleware: test with `CacheErrorResponses = true` and 4xx/5xx responses
- [ ] InMemoryCache SetMany: test with large batch to verify shared `MemoryCacheEntryOptions` does not cause issues
- [ ] RequestEnrichment middleware: test with IPv4-mapped IPv6 address format (::ffff:x.x.x.x)

**Tests to remove**: None

---

**Cross-platform parity summary**:

| Area                   | .NET                                        | Node.js                                   | Parity    |
|------------------------|---------------------------------------------|-------------------------------------------|-----------|
| In-memory cache        | IMemoryCache (no LRU, no max)               | MemoryCacheStore (LRU, 10k max)           | Divergent |
| Redis cache            | StackExchange.Redis (7 handlers + Ping)     | ioredis (7 handlers + Ping)               | Aligned   |
| Redis serialization    | JSON + Protobuf (reflection)                | JSON + pluggable ICacheSerializer         | Aligned   |
| Rate limit algorithm   | Sliding window, parallel dimensions         | Sliding window, parallel dimensions       | Aligned   |
| Rate limit trust bypass| IsTrustedService early return               | Not implemented                           | Gap       |
| Idempotency handler    | SET NX + GET, fail-open                     | SET NX + GET, fail-open                   | Aligned   |
| Idempotency middleware | ASP.NET Core middleware with body capture   | Framework-agnostic `checkIdempotency()`   | Aligned*  |
| Idempotency options    | 5 options (methods, cacheErrors)            | 3 options (no methods, no cacheErrors)    | Gap       |
| IP resolution          | 4-step priority chain                       | 4-step priority chain                     | Aligned   |
| Fingerprint            | SHA-256 of 4 headers                        | SHA-256 of 4 headers                      | Aligned   |
| Request enrichment     | IRequestInfo with IsTrustedService          | IRequestInfo without IsTrustedService     | Gap       |
| Messaging              | ProtoPublisher + ProtoConsumer (low-level)  | MessageBus (unified, higher-level)        | Divergent |
| Batch queries          | BatchQuery<TEntity, TKey> (EF Core)         | N/A (no ORM in Node services)             | N/A       |
| Transactions           | Begin/Commit/Rollback (EF Core)             | N/A (Drizzle handles tx differently)      | N/A       |
| Header casing          | PascalCase (ASP.NET convention)             | lowercase (Node/HTTP convention)          | Expected  |

\* Idempotency middleware is structurally different (ASP.NET middleware vs framework-agnostic function) but functionally equivalent.
