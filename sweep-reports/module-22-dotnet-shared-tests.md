# Module 22: .NET Shared Tests (`D2.Shared.Tests`)

## Sweep Summary

| Metric            | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| **Scope**         | `backends/dotnet/shared/Tests/` (1 project, 35 .cs files) |
| **Test Count**    | ~305 tests across 33 test files + 1 helper + 1 .csproj    |
| **Frameworks**    | xUnit v3, FluentAssertions 8.x, Moq 4.x, Testcontainers   |
| **Overall Grade** | **A-** -- Excellent breadth, strong patterns, minor gaps  |

---

## Files Reviewed

| #   | File                                                                    | Tests | Notes                               |
| --- | ----------------------------------------------------------------------- | ----: | ----------------------------------- |
| 1   | `Tests.csproj`                                                          |   --- | Project references, dependencies    |
| 2   | `TestHelpers.cs`                                                        |   --- | Shared infra (GeoRefData, context)  |
| 3   | `Unit/D2ResultTests.cs`                                                 |    11 | Non-generic D2Result                |
| 4   | `Unit/D2ResultGenericTests.cs`                                          |    20 | Generic D2Result\<T\>               |
| 5   | `Unit/DefaultMemoryCacheTests.cs`                                       |    12 | In-memory cache handlers            |
| 6   | `Unit/EnumerableExtensionsTests.cs`                                     |    17 | Truthy/Falsey/Clean extensions      |
| 7   | `Unit/GuidExtensionsTests.cs`                                           |    17 | Guid Truthy/Falsey extensions       |
| 8   | `Unit/StringExtensionsTests.cs`                                         |    21 | String extensions (clean, validate) |
| 9   | `Unit/ProtoExtensionsTests.cs`                                          |    12 | D2Result <-> Proto conversions      |
| 10  | `Unit/D2EnvTests.cs`                                                    |    11 | D2Env .env.local loading            |
| 11  | `Unit/BatchPg/BatchOptionsTests.cs`                                     |     7 | BatchOptions defaults/custom        |
| 12  | `Unit/Geo/Client/FindWhoIsHandlerTests.cs`                              |    12 | FindWhoIs handler (fail-open)       |
| 13  | `Unit/Middleware/RateLimit/RateLimitMiddlewareTests.cs`                 |    12 | RateLimit middleware pipeline       |
| 14  | `Unit/Middleware/RateLimit/CheckHandlerTests.cs`                        |    11 | RateLimit Check handler             |
| 15  | `Unit/Middleware/RequestEnrichment/FingerprintBuilderTests.cs`          |    10 | Server fingerprint SHA-256          |
| 16  | `Unit/Middleware/RequestEnrichment/IpResolverTests.cs`                  |    11 | IP resolution priority chain        |
| 17  | `Unit/Middleware/RequestEnrichment/RequestEnrichmentMiddlewareTests.cs` |    11 | RequestEnrichment middleware        |
| 18  | `Unit/Middleware/Idempotency/CheckHandlerTests.cs`                      |    13 | Idempotency Check handler           |
| 19  | `Unit/Middleware/Idempotency/IdempotencyMiddlewareTests.cs`             |    26 | Idempotency middleware pipeline     |
| 20  | `Unit/Gateway/AuthPolicyTests.cs`                                       |    10 | Auth policies, role hierarchy       |
| 21  | `Unit/Gateway/JwtAuthConfigTests.cs`                                    |     7 | JWT configuration (RS256, JWKS)     |
| 22  | `Unit/Gateway/JwtFingerprintMiddlewareTests.cs`                         |    10 | JWT fingerprint middleware          |
| 23  | `Unit/Gateway/JwtFingerprintValidatorTests.cs`                          |     8 | JWT fingerprint validator           |
| 24  | `Unit/Gateway/RequestContextJwtTests.cs`                                |    20 | JWT claim extraction                |
| 25  | `Unit/Gateway/RequestContextOrgEmulationTests.cs`                       |    12 | Org emulation logic                 |
| 26  | `Unit/Gateway/ServiceKeyEndpointFilterTests.cs`                         |     3 | ServiceKey endpoint filter          |
| 27  | `Unit/Gateway/ServiceKeyMiddlewareTests.cs`                             |     6 | ServiceKey middleware               |
| 28  | `Unit/Handler/DefaultOptionsTests.cs`                                   |     7 | BaseHandler DefaultOptions          |
| 29  | `Unit/Handler/ValidatorsTests.cs`                                       |    15 | FluentValidation custom validators  |
| 30  | `Unit/Retry/D2RetryHelperTests.cs`                                      |    29 | D2RetryHelper (clean + dirty retry) |
| 31  | `Unit/Retry/RetryHelperTests.cs`                                        |    22 | RetryHelper (exception-based retry) |
| 32  | `Unit/Logging/RedactDataDestructuringPolicyTests.cs`                    |    15 | Serilog redaction policy            |
| 33  | `Integration/RedisDistributedCacheTests.cs`                             |    16 | Redis cache with Testcontainers     |
| 34  | `Integration/TransactionsPgTests.cs`                                    |     8 | PG transactions with Testcontainers |
| 35  | `Integration/Middleware/RateLimitRedisTests.cs`                         |    10 | Rate limiting with real Redis       |

---

## Findings

### Critical

No critical issues found.

### High Severity

| #   | Category     | Finding                                                                                                                                                  | Location                                                                   | Recommendation                                                                                                                                                                                                    |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1 | Coverage Gap | Messaging.RabbitMQ has zero tests                                                                                                                        | No test file exists                                                        | Add unit tests for ProtoPublisher, ProtoConsumer, AmqpConventions, Ping handler. These are shared infrastructure used by Geo and Comms services                                                                   |
| H-2 | Coverage Gap | BatchQuery has zero tests (only BatchOptions tested)                                                                                                     | `Unit/BatchPg/BatchOptionsTests.cs`                                        | Add integration tests for `BatchQuery.ToListAsync`, `ToDictionaryAsync`, `GetMissingIdsAsync`, `ToAsyncEnumerable` with Testcontainers PG. BatchQuery contains non-trivial expression building and batching logic |
| H-3 | Coverage Gap | Batch.Pg `D2ResultExtensions` has zero tests                                                                                                             | No test file for D2ResultExtensions                                        | Add unit tests for the D2Result batch extensions (these bridge batch queries to D2Result pattern)                                                                                                                 |
| H-4 | Consistency  | Mixed assertion frameworks: D2ResultTests and D2ResultGenericTests use xUnit Assert; retry tests use xUnit Assert; most other tests use FluentAssertions | `Unit/D2ResultTests.cs`, `Unit/D2ResultGenericTests.cs`, `Unit/Retry/*.cs` | Standardize on FluentAssertions for all test files. The codebase already depends on it and it provides better failure messages. This is a ~90-line refactor across 4 files                                        |

### Medium Severity

| #   | Category     | Finding                                                                                                              | Location                                    | Recommendation                                                                                                                                                                                                                                                                                                           |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M-1 | Coverage Gap | ServiceDefaults extension methods untested                                                                           | `ServiceDefaults/Extensions*.cs`            | The 3 Extensions files configure OTel, health checks, Serilog. These are mostly wiring code but `AddDefaultHealthChecks` and `MapDefaultEndpoints` contain conditional logic that could benefit from smoke tests                                                                                                         |
| M-2 | Coverage Gap | `BaseHandler` core execution path tested only via DefaultOptionsTests                                                | `Unit/Handler/DefaultOptionsTests.cs`       | BaseHandler is the foundational type. Consider dedicated tests for: (a) tracing span creation, (b) `TraceId` property propagation, (c) `CheckSuccess`/`CheckFailure` calls within a handler, (d) `BHASW` (BaseHandler with validation). The DefaultOptionsTests cover logging control well but miss the tracing pipeline |
| M-3 | Coverage Gap | `IHandlerContext` / `HandlerContext` implementation untested                                                         | `Handler/HandlerContext.cs`                 | The concrete HandlerContext class is used in production DI. Add tests to verify it correctly composes IRequestContext and ILogger                                                                                                                                                                                        |
| M-4 | Coverage Gap | No integration test for Redis distributed cache `SetNx`, `GetTtl`, or `Increment` handlers                           | `Integration/RedisDistributedCacheTests.cs` | Current Redis integration tests cover Get, Set, Remove, Exists. The rate limit integration test exercises Increment/GetTtl indirectly, but there are no direct handler-level integration tests for SetNx (idempotency), GetTtl, or Increment                                                                             |
| M-5 | Coverage Gap | REST Gateway `ResultExtensions.cs` untested                                                                          | `REST/ResultExtensions.cs`                  | This maps D2Result to HTTP responses. Add unit tests to verify correct status code mapping and response body serialization                                                                                                                                                                                               |
| M-6 | Coverage Gap | `ServiceKeyExtensions.cs` and `ServiceKeyOptions.cs` untested                                                        | `REST/Auth/ServiceKey*.cs`                  | The DI registration extensions and options class have no direct tests. The middleware tests cover runtime behavior but not the registration path                                                                                                                                                                         |
| M-7 | Test Quality | D2EnvTests uses `IClassFixture` for file creation/cleanup but creates files in test output directory                 | `Unit/D2EnvTests.cs`                        | Consider using a temporary directory with `IDisposable` cleanup to avoid polluting test output. Low risk but could cause issues in parallel test runs                                                                                                                                                                    |
| M-8 | Coverage Gap | `Validators.cs` has no tests for `IsValidCountryCode`, `IsValidSubdivisionCode`, `IsValidCurrencyCode` if they exist | `Unit/Handler/ValidatorsTests.cs`           | The test file covers IP, HashId, Guid, Email, PhoneE164, NonEmpty. Verify whether Validators.cs has additional validation methods not covered                                                                                                                                                                            |
| M-9 | Coverage Gap | Idempotency `Complete` handler untested                                                                              | Only `Check` handler tested                 | The Idempotency middleware has both Check (tested) and Complete (stores cached response) handlers. Complete handler should have dedicated unit tests                                                                                                                                                                     |

### Low Severity

| #    | Category      | Finding                                                                                                  | Location                                             | Recommendation                                                                                                                                                                    |
| ---- | ------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-1  | Documentation | No XML doc on `TestHelpers.CreateHandlerContext()` method                                                | `TestHelpers.cs`                                     | Add XML doc explaining what the mock context provides (trace ID, user ID, org IDs, logger)                                                                                        |
| L-2  | Test Quality  | `ServiceKeyEndpointFilterTests` has only 3 tests                                                         | `Unit/Gateway/ServiceKeyEndpointFilterTests.cs`      | Consider adding edge cases: null HttpContext, missing Features collection, concurrent access                                                                                      |
| L-3  | Organization  | Gateway tests reference REST project but live under shared Tests                                         | `Unit/Gateway/*.cs`                                  | Acceptable since REST gateway is tightly coupled to Handler.Extensions, but consider whether gateway tests should live closer to the gateway project in the future                |
| L-4  | Test Quality  | `JwtAuthConfigTests` validates token signing/verification inline                                         | `Unit/Gateway/JwtAuthConfigTests.cs`                 | The inline RSA key generation in tests is appropriate for unit tests but could be extracted to TestHelpers for reuse                                                              |
| L-5  | Coverage Gap  | `SerializerOptions` static class untested                                                                | `Utilities/Serialization/SerializerOptions.cs`       | Trivial configuration class. No test needed unless more options are added                                                                                                         |
| L-6  | Coverage Gap  | `Constants` static class untested                                                                        | `Utilities/Constants/Constants.cs`                   | Pure constants. No test needed                                                                                                                                                    |
| L-7  | Coverage Gap  | Interfaces project has no tests (by design)                                                              | `Interfaces/` (all interfaces/records)               | Interface/record definitions don't need tests. Covered transitively by implementation tests                                                                                       |
| L-8  | Test Quality  | Some test methods use `var result = await handler.HandleAsync(...)` without asserting intermediate state | Various middleware tests                             | Minor: in most cases the result assertion is sufficient. Could add intermediate `Mock.Verify` calls for clearer failure diagnostics                                               |
| L-9  | Naming        | `DefaultMemoryCacheTests.cs` tests all 5 in-memory handlers in one file                                  | `Unit/DefaultMemoryCacheTests.cs`                    | Consider splitting into per-handler test files (GetTests, SetTests, etc.) as the handler count grows. Not urgent at 12 tests                                                      |
| L-10 | Test Quality  | RedactDataDestructuringPolicyTests has a custom `SerilogPropertyValueFactory` adapter                    | `Unit/Logging/RedactDataDestructuringPolicyTests.cs` | Well-implemented workaround for Serilog's internal factory. Add a comment explaining WHY this adapter is needed (Serilog doesn't expose `ILogEventPropertyValueFactory` publicly) |

---

## Coverage Matrix

Cross-reference of shared projects against test coverage:

| Shared Project                   | Unit Tests | Integration Tests | Coverage Level | Notes                                                     |
| -------------------------------- | :--------: | :---------------: | :------------: | --------------------------------------------------------- |
| **Result**                       |     31     |        --         |     Strong     | D2Result + D2Result\<T\> well covered                     |
| **Result (Retry)**               |     51     |        --         |     Strong     | D2RetryHelper (29) + RetryHelper (22), excellent          |
| **Result.Extensions**            |     12     |        --         |     Strong     | Proto conversions with round-trip tests                   |
| **Utilities (Extensions)**       |     55     |        --         |     Strong     | Enumerable (17) + Guid (17) + String (21)                 |
| **Utilities (D2Env)**            |     11     |        --         |     Strong     | Infrastructure + options transforms tested                |
| **Utilities (Attributes)**       |     --     |        --         |    Indirect    | Tested via RedactDataDestructuringPolicyTests             |
| **Handler (BaseHandler)**        |     7      |        --         |    Moderate    | DefaultOptions tested; tracing path not covered           |
| **Handler (Validators)**         |     15     |        --         |     Strong     | All 6 custom validators tested                            |
| **Handler (Auth constants)**     |     10     |        --         |     Strong     | AuthPolicies + role hierarchy tested                      |
| **Handler.Extensions**           |     42     |        --         |     Strong     | RequestContext JWT + OrgEmulation well covered            |
| **ServiceDefaults (Logging)**    |     15     |        --         |     Strong     | RedactDataDestructuringPolicy thoroughly tested           |
| **ServiceDefaults (Extensions)** |     --     |        --         |      None      | OTel/health-check wiring untested                         |
| **InMemoryCache.Default**        |     12     |        --         |      Good      | All 5 handler types covered                               |
| **DistributedCache.Redis**       |     --     |        16         |      Good      | Get, Set, Remove, Exists; missing SetNx/GetTtl/Incr       |
| **RateLimit.Default**            |     23     |        10         |     Strong     | Unit + integration, fail-open + dimension skip            |
| **RequestEnrichment.Default**    |     32     |        --         |     Strong     | Fingerprint + IP + middleware pipeline                    |
| **Idempotency.Default**          |     39     |        --         |     Strong     | Check handler + middleware (26), but no Complete test     |
| **Transactions.Pg**              |     --     |         8         |      Good      | Full lifecycle with Testcontainers                        |
| **Batch.Pg**                     |     7      |        --         |      Weak      | Only BatchOptions; BatchQuery/D2ResultExtensions untested |
| **Messaging.RabbitMQ**           |     --     |        --         |      None      | Zero tests for publisher, consumer, conventions           |
| **REST Gateway (Auth)**          |     56     |        --         |     Strong     | JWT, fingerprint, service key, policies                   |
| **REST Gateway (Other)**         |     --     |        --         |      None      | ResultExtensions, endpoints untested                      |
| **Geo.Client (FindWhoIs)**       |     12     |        --         |      Good      | Cache hit/miss, fail-open, gRPC errors                    |

---

## Strengths

1. **Fail-open testing is exemplary** -- Every middleware (RateLimit, RequestEnrichment, Idempotency) has dedicated tests for cache unavailability, exception scenarios, and graceful degradation. This is critical for production resilience and is well-executed.

2. **Retry testing is thorough** -- Both D2RetryHelper (D2Result-aware) and RetryHelper (exception-based) have comprehensive coverage: transient vs permanent classification, backoff timing, jitter, cancellation, custom predicates, exhaustion, and attempt numbering. 51 tests across both files.

3. **Middleware dimension/skip logic is well-tested** -- RateLimit CheckHandler tests verify that each dimension (fingerprint, IP, city, country) is correctly skipped when data is null, localhost, or whitelisted. This prevents false positives in production.

4. **Integration tests use Testcontainers correctly** -- Redis and PostgreSQL integration tests spin up real containers, avoiding mocking infrastructure code. The RateLimitRedis integration test is particularly valuable as it validates the sliding-window algorithm against real Redis.

5. **Gateway auth tests are comprehensive** -- 56 tests covering JWT configuration, fingerprint validation, service key middleware, request context extraction, org emulation, and auth policies. Cross-platform parity test (`Node.js parity`) in JwtFingerprintValidatorTests is excellent.

6. **Redaction policy tests cover real Serilog pipeline** -- The tests include both unit-level destructuring AND integration with actual Serilog logger (scalar vs destructured parameter tests), proving the policy works in the real logging pipeline.

7. **Edge case coverage** -- Unicode/emoji in idempotency cache, escaped JSON, empty JSON objects, partial JSON, JSON arrays, null values -- all tested for correct behavior.

8. **Test naming is descriptive and consistent** -- Format `Method_WhenCondition_ExpectedBehavior` used throughout.

---

## Anti-Patterns Identified

1. **Mixed assertion styles** (H-4) -- D2ResultTests, D2ResultGenericTests, and both retry test files use raw `Assert.True/False/Equal` while the rest of the codebase uses FluentAssertions. This creates inconsistency in failure message quality and readability.

2. **No anti-pattern issues with test isolation** -- All tests use proper Moq setup/verify, no shared mutable state between tests, Testcontainers provide clean isolation.

3. **No flaky test indicators found** -- No `Thread.Sleep`, no hardcoded ports, no time-dependent assertions without tolerance. Mock delays in retry tests are deterministic. Integration tests use Testcontainers with proper async lifecycle.

---

## Recommended Priority Actions

| Priority | Action                                                          | Effort | Impact |
| -------- | --------------------------------------------------------------- | ------ | ------ |
| 1        | Add Messaging.RabbitMQ tests (H-1)                              | Medium | High   |
| 2        | Add BatchQuery integration tests (H-2)                          | Medium | High   |
| 3        | Add Batch.Pg D2ResultExtensions unit tests (H-3)                | Low    | Medium |
| 4        | Standardize on FluentAssertions (H-4)                           | Low    | Medium |
| 5        | Add Redis SetNx/GetTtl/Increment direct integration tests (M-4) | Low    | Medium |
| 6        | Add Idempotency Complete handler tests (M-9)                    | Low    | Medium |
| 7        | Add BaseHandler tracing path tests (M-2)                        | Medium | Medium |
| 8        | Add REST ResultExtensions tests (M-5)                           | Low    | Low    |

---

## Test Infrastructure Quality

| Aspect                   | Assessment                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **Test isolation**       | Excellent -- no shared mutable state, proper DI mocking                             |
| **Test helpers**         | Good -- `TestHelpers.cs` provides reusable context + GeoRefData                     |
| **Assertion quality**    | Good (FluentAssertions) to Adequate (raw Assert)                                    |
| **CancellationToken**    | Excellent -- `TestContext.Current.CancellationToken` used consistently via xUnit v3 |
| **Naming conventions**   | Excellent -- descriptive, consistent format throughout                              |
| **File organization**    | Good -- mirrors source structure with Unit/Integration split                        |
| **Container management** | Excellent -- `IAsyncLifetime` for clean startup/teardown                            |
| **XML documentation**    | Good -- most test classes and methods have XML docs                                 |
| **License headers**      | Complete -- all files have DCSV copyright headers                                   |
