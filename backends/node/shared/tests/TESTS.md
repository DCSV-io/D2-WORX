# @d2/shared-tests

Centralized test suite for all shared Node.js packages. Mirrors .NET `D2.Shared.Tests` — test projects are separate from source packages (source packages have zero test dependencies).

**Total:** 844 tests (unit + integration) across 67 files

---

## Unit Tests

| Test File                                          | Package                | Tests | Description                                                       |
| -------------------------------------------------- | ---------------------- | ----- | ----------------------------------------------------------------- |
| `d2-result.test.ts`                                | @d2/result             | 47    | Factory methods, helpers, error codes, status codes.              |
| `retry-result.test.ts`                             | @d2/result             | 14    | RetryResult clean/dirty retry wrappers + abort/error propagation. |
| `retry.test.ts`                                    | @d2/utilities          | 14    | retryAsync with exponential backoff, transient error detection.   |
| `array-extensions.test.ts`                         | @d2/utilities          | 11    | Array truthy/falsey helpers.                                      |
| `string-extensions.test.ts`                        | @d2/utilities          | 18    | String cleaning, email validation, hashing.                       |
| `uuid-extensions.test.ts`                          | @d2/utilities          | 14    | UUID truthy/falsey helpers + UUIDv7 generation.                   |
| `constants.test.ts`                                | @d2/utilities          | 3     | Cache key prefix constants.                                       |
| `utilities/escape-html.test.ts`                    | @d2/utilities          | 8     | HTML entity escaping for XSS prevention.                          |
| `utilities/generate-uuid-v7.test.ts`               | @d2/utilities          | 16    | UUIDv7 format, uniqueness, time-sortability.                      |
| `protos.test.ts`                                   | @d2/protos             | 3     | Proto type availability/import verification.                      |
| `protos/comms-roundtrip.test.ts`                   | @d2/protos             | 8     | Comms DTO roundtrip encode/decode (3 DTOs).                       |
| `protos/event-contract.test.ts`                    | @d2/protos             | 4     | Event proto contract compatibility.                               |
| `logging.test.ts`                                  | @d2/logging            | 10    | Logger implementation, child loggers, levels.                     |
| `handler.test.ts`                                  | @d2/handler            | 18    | BaseHandler OTel integration, metrics, options, safeStringify.    |
| `handler-redaction.test.ts`                        | @d2/handler            | 17    | Input/output field masking, suppression, edge cases.              |
| `validate-input.test.ts`                           | @d2/handler            | 4     | Zod schema validation via BaseHandler.validateInput.              |
| `validators.test.ts`                               | @d2/handler            | 28    | Zod refinements: zodGuid, zodHashId, zodIpAddress, zodEmail, etc. |
| `di/service-collection.test.ts`                    | @d2/di                 | 15    | ServiceCollection registration, build, lifetime semantics.        |
| `di/service-provider.test.ts`                      | @d2/di                 | 25    | Resolve, scoping, circular dependency detection, setInstance.     |
| `di/traceid-auto-injection.test.ts`                | @d2/di                 | 6     | TraceId auto-injection through DI scopes.                         |
| `interfaces/in-memory-cache.test.ts`               | @d2/interfaces         | 5     | In-memory cache interface type checks.                            |
| `interfaces/distributed-cache.test.ts`             | @d2/interfaces         | 6     | Distributed cache interface type checks.                          |
| `result-extensions/d2-result-to-proto.test.ts`     | @d2/result-extensions  | 10    | D2Result → Proto conversion.                                      |
| `result-extensions/d2-result-from-proto.test.ts`   | @d2/result-extensions  | 10    | Proto → D2Result conversion.                                      |
| `result-extensions/handle-grpc-call.test.ts`       | @d2/result-extensions  | 12    | gRPC call wrapper error handling.                                 |
| `cache-memory/memory-cache-store.test.ts`          | @d2/cache-memory       | 13    | MemoryCacheStore core operations.                                 |
| `cache-memory/lru.test.ts`                         | @d2/cache-memory       | 8     | LRU eviction behavior and capacity limits.                        |
| `cache-memory/get.test.ts`                         | @d2/cache-memory       | 4     | Get handler.                                                      |
| `cache-memory/get-many.test.ts`                    | @d2/cache-memory       | 4     | GetMany handler.                                                  |
| `cache-memory/set.test.ts`                         | @d2/cache-memory       | 3     | Set handler.                                                      |
| `cache-memory/set-many.test.ts`                    | @d2/cache-memory       | 3     | SetMany handler.                                                  |
| `cache-memory/remove.test.ts`                      | @d2/cache-memory       | 2     | Remove handler.                                                   |
| `cache-memory/falsy-values.test.ts`                | @d2/cache-memory       | 10    | Handling of null/undefined/0/false values.                        |
| `cache-redis/serialization.test.ts`                | @d2/cache-redis        | 8     | JsonCacheSerializer.                                              |
| `cache-redis/redis-error-paths.test.ts`            | @d2/cache-redis        | 8     | Error handling paths (includes SetNx).                            |
| `cache-redis/ping-cache.test.ts`                   | @d2/cache-redis        | 4     | PingCache healthy, unhealthy, error, latency.                     |
| `messaging/message-bus.test.ts`                    | @d2/messaging          | 7     | MessageBus unit tests.                                            |
| `messaging/ping-message-bus.test.ts`               | @d2/messaging          | 4     | PingMessageBus healthy, unhealthy, error, latency.                |
| `service-defaults.test.ts`                         | @d2/service-defaults   | 20    | setupTelemetry, register, telemetry config smoke tests.           |
| `service-defaults/is-transient-grpc-error.test.ts` | @d2/service-defaults   | 6     | gRPC transient error classification.                              |
| `geo-client/ref-data-handlers.test.ts`             | @d2/geo-client         | 12    | Get/Set/Req reference data handlers.                              |
| `geo-client/find-whois.test.ts`                    | @d2/geo-client         | 10    | FindWhoIs multi-tier cache + gRPC fallback.                       |
| `geo-client/get.test.ts`                           | @d2/geo-client         | 6     | Get handler multi-tier orchestration.                             |
| `geo-client/get-contacts-by-ids.test.ts`           | @d2/geo-client         | 8     | GetContactsByIds cache-aside + fail-open.                         |
| `geo-client/contacts-evicted.test.ts`              | @d2/geo-client         | 5     | ContactsEvicted handler: evict by ID/ext-key, failure tolerance.  |
| `geo-client/updated.test.ts`                       | @d2/geo-client         | 6     | Updated message handler.                                          |
| `geo-client/updated-consumer.test.ts`              | @d2/geo-client         | 5     | Consumer factory.                                                 |
| `geo-client/create-contacts.test.ts`               | @d2/geo-client         | 7     | CreateContacts handler + allowedContextKeys validation.           |
| `geo-client/get-contacts-by-ext-keys.test.ts`      | @d2/geo-client         | 10    | GetContactsByExtKeys cache-aside, fail-open, key validation.      |
| `geo-client/delete-contacts-by-ext-keys.test.ts`   | @d2/geo-client         | 9     | DeleteContactsByExtKeys gRPC + cache eviction + key validation.   |
| `geo-client/update-contacts-by-ext-keys.test.ts`   | @d2/geo-client         | 9     | UpdateContactsByExtKeys gRPC replace + cache eviction.            |
| `idempotency/check.test.ts`                        | @d2/idempotency        | 13    | Idempotency check handler (SET NX, sentinel, replay).             |
| `idempotency/check-idempotency.test.ts`            | @d2/idempotency        | 12    | Framework-agnostic orchestrator.                                  |
| `request-enrichment/ip-resolver.test.ts`           | @d2/request-enrichment | 9     | IP resolution from headers.                                       |
| `request-enrichment/fingerprint-builder.test.ts`   | @d2/request-enrichment | 9     | Server fingerprint generation.                                    |
| `request-enrichment/enrich-request.test.ts`        | @d2/request-enrichment | 12    | Full enrichment flow.                                             |
| `ratelimit/check.test.ts`                          | @d2/ratelimit          | 35    | Rate limiting logic, all dimensions.                              |

---

## Integration Tests

| Test File                                     | Package         | Tests | Infrastructure           |
| --------------------------------------------- | --------------- | ----- | ------------------------ |
| `cache-redis/get.test.ts`                     | @d2/cache-redis | 6     | @testcontainers/redis    |
| `cache-redis/set.test.ts`                     | @d2/cache-redis | 4     | @testcontainers/redis    |
| `cache-redis/set-nx.test.ts`                  | @d2/cache-redis | 6     | @testcontainers/redis    |
| `cache-redis/remove.test.ts`                  | @d2/cache-redis | 2     | @testcontainers/redis    |
| `cache-redis/exists.test.ts`                  | @d2/cache-redis | 2     | @testcontainers/redis    |
| `cache-redis/get-ttl.test.ts`                 | @d2/cache-redis | 3     | @testcontainers/redis    |
| `cache-redis/increment.test.ts`               | @d2/cache-redis | 4     | @testcontainers/redis    |
| `messaging/message-bus.integration.test.ts`   | @d2/messaging   | 3     | @testcontainers/rabbitmq |
| `ratelimit/check.integration.test.ts`         | @d2/ratelimit   | 5     | @testcontainers/redis    |
| `idempotency/idempotency-integration.test.ts` | @d2/idempotency | 12    | @testcontainers/redis    |

---

## Test Infrastructure

- **Runner:** Vitest 3.x with root config discovery
- **Assertions:** Vitest `expect` + custom `@d2/testing` matchers (`toBeSuccess`, `toBeFailure`, `toHaveData`, `toHaveErrorCode`, `toHaveStatusCode`, `toHaveMessages`, `toHaveInputErrors`)
- **Mocking:** `vi.mock`, `vi.fn`, `vi.spyOn` — prefer dependency injection over module mocking
- **Containers:** `@testcontainers/redis`, `@testcontainers/rabbitmq` for integration tests
- **Run:** `pnpm vitest run --project shared-tests` or `pnpm vitest` (all projects)

## .NET Equivalent

`D2.Shared.Tests` — xUnit + FluentAssertions + Moq + Testcontainers.
