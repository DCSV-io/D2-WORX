### Module 5: Interfaces + Result Extensions

**Files reviewed**: 43 files (32 source + 5 test + 6 config/doc)

**Source total**: 413 lines across 32 files (interfaces: 325, result-extensions: 88)
**Test total**: 1,011 lines across 5 files (54 test cases total)

| File                                                             | Lines |
| ---------------------------------------------------------------- | ----- |
| `interfaces/src/index.ts`                                        | 9     |
| `interfaces/src/caching/in-memory/index.ts`                      | 5     |
| `interfaces/src/caching/in-memory/handlers/r/get.ts`             | 14    |
| `interfaces/src/caching/in-memory/handlers/r/get-many.ts`        | 14    |
| `interfaces/src/caching/in-memory/handlers/u/set.ts`             | 15    |
| `interfaces/src/caching/in-memory/handlers/u/set-many.ts`        | 14    |
| `interfaces/src/caching/in-memory/handlers/d/remove.ts`          | 13    |
| `interfaces/src/caching/distributed/index.ts`                    | 8     |
| `interfaces/src/caching/distributed/handlers/r/get.ts`           | 14    |
| `interfaces/src/caching/distributed/handlers/r/exists.ts`        | 14    |
| `interfaces/src/caching/distributed/handlers/r/get-ttl.ts`       | 14    |
| `interfaces/src/caching/distributed/handlers/c/set-nx.ts`        | 16    |
| `interfaces/src/caching/distributed/handlers/u/set.ts`           | 15    |
| `interfaces/src/caching/distributed/handlers/u/increment.ts`     | 16    |
| `interfaces/src/caching/distributed/handlers/d/remove.ts`        | 13    |
| `interfaces/src/caching/distributed/handlers/q/ping.ts`          | 14    |
| `interfaces/src/messaging/index.ts`                              | 1     |
| `interfaces/src/messaging/handlers/index.ts`                     | 1     |
| `interfaces/src/messaging/handlers/q/ping.ts`                    | 14    |
| `interfaces/src/middleware/request-enrichment/i-request-info.ts` | 32    |
| `interfaces/src/middleware/request-enrichment/index.ts`          | 1     |
| `interfaces/src/middleware/ratelimit/rate-limit-dimension.ts`    | 12    |
| `interfaces/src/middleware/ratelimit/handlers/check.ts`          | 25    |
| `interfaces/src/middleware/ratelimit/index.ts`                   | 3     |
| `interfaces/src/middleware/idempotency/cached-response.ts`       | 6     |
| `interfaces/src/middleware/idempotency/idempotency-state.ts`     | 2     |
| `interfaces/src/middleware/idempotency/handlers/check.ts`        | 17    |
| `interfaces/src/middleware/idempotency/index.ts`                 | 3     |
| `result-extensions/src/index.ts`                                 | 3     |
| `result-extensions/src/d2-result-to-proto.ts`                    | 22    |
| `result-extensions/src/d2-result-from-proto.ts`                  | 21    |
| `result-extensions/src/handle-grpc-call.ts`                      | 42    |
| Tests: `distributed-cache.test.ts`                               | 266   |
| Tests: `in-memory-cache.test.ts`                                 | 219   |
| Tests: `d2-result-from-proto.test.ts`                            | 147   |
| Tests: `d2-result-to-proto.test.ts`                              | 172   |
| Tests: `handle-grpc-call.test.ts`                                | 207   |

---

**Assumptions documented**:

1. **Cache key format is unconstrained** -- All cache interfaces accept `key: string` with no validation at the interface level. Key format conventions (e.g., `EntityName:{id}`) are enforced by callers, not by the interface contracts.
2. **All handlers implement `IHandler<TInput, TOutput>`** -- Every handler interface is defined as `IHandler<X, Y>` from `@d2/handler`, meaning all return `Promise<D2Result<TOutput | undefined>>`.
3. **In-memory cache miss = failure, distributed cache miss = failure in practice** -- The in-memory `GetOutput<TValue>` has `value: TValue` (non-optional), while the distributed `GetOutput<TValue>` has `value: TValue | undefined`. The actual Redis implementation returns `D2Result.notFound()` on cache miss for both.
4. **Proto `statusCode` always maps to a valid `HttpStatusCode`** -- `d2ResultFromProto` casts `proto.statusCode as HttpStatusCode` without runtime validation.
5. **gRPC `ServiceError` is uniquely identifiable by `Error + numeric code`** -- The `isServiceError` type guard assumes no other Error subclass will have a numeric `code` property.
6. **`expirationMs` semantics are implementation-defined** -- All Set/SetNx/Increment interfaces accept `expirationMs?: number` as optional, with no contract specifying what "no expiration" means.
7. **`IRequestInfo` readonly properties are immutable after enrichment** -- All geo/fingerprint fields are `readonly`, while `userId` and `isAuthenticated` are mutable (set later by auth middleware).
8. **`RateLimitDimension` values are lowercase-safe** -- The rate limit implementation calls `.toLowerCase()` on dimension values for cache key construction.
9. **`handleGrpcCall` callers provide non-null `resultSelector` results** -- Callers use `res.result!` (non-null assertion).

---

**Findings**:

| #   | Severity | Category        | File:Line                                                          | Description                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------- | --------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Medium   | Consistency     | `interfaces/src/middleware/request-enrichment/i-request-info.ts`   | **Missing `isTrustedService` property.** The .NET `IRequestInfo` has `bool IsTrustedService { get; set; }`, used by rate limiter and fingerprint validator to bypass checks for S2S calls. The Node.js interface omits this entirely. The Node.js rate limiter has no trusted-service bypass.                                                                                                 |
| 2   | Medium   | Consistency     | `interfaces/src/caching/distributed/handlers/r/get.ts:10`          | **`GetOutput.value` is `TValue \| undefined` but Redis implementation returns `D2Result.notFound()` on cache miss, not `D2Result.ok({ value: undefined })`.** The interface type suggests cache miss = success with undefined value, but actual behavior is failure result. Semantic mismatch doesn't cause runtime bugs (consumers handle both paths) but is confusing for new implementors. |
| 3   | Low      | Security        | `result-extensions/src/d2-result-from-proto.ts:17`                 | **Unsafe type assertion `proto.statusCode as HttpStatusCode`.** The proto `status_code` field is `int32` (any integer), cast without runtime validation.                                                                                                                                                                                                                                      |
| 4   | Low      | Maintainability | `interfaces/INTERFACES.md:72`                                      | **Documentation claims `CHECK_REDACTION` exists in idempotency but it does not.** The actual `idempotency/handlers/check.ts` only exports `CheckInput`, `CheckOutput`, and `ICheckHandler`.                                                                                                                                                                                                   |
| 5   | Low      | Consistency     | `interfaces/src/middleware/idempotency/handlers/check.ts`          | **`Idempotency.ICheckHandler` is a plain `type` alias while `RateLimit.ICheckHandler` is an `interface extends IHandler` with required `redaction`.** Deliberate (idempotency has no PII) but asymmetric. Needs JSDoc explaining why.                                                                                                                                                         |
| 6   | Low      | Maintainability | `tests/src/unit/interfaces/distributed-cache.test.ts:2`            | **Unused import `HttpStatusCode`.** Never referenced in the file.                                                                                                                                                                                                                                                                                                                             |
| 7   | Low      | Consistency     | `distributed/handlers/q/ping.ts` vs `messaging/handlers/q/ping.ts` | **`PingInput`/`PingOutput`/`IPingHandler` identically defined in both `DistributedCache` and `Messaging` namespaces.** Could be extracted to shared `health/` module. Low priority — types are stable and small.                                                                                                                                                                              |
| 8   | Low      | Maintainability | Various handler files                                              | **Blank line inconsistency before empty output interfaces.** Minor formatting.                                                                                                                                                                                                                                                                                                                |
| 9   | Low      | Elegance        | `interfaces/src/index.ts:5`                                        | **`RateLimit` is the only non-`type` import/export in the barrel.** Correct because it has runtime values (`RateLimitDimension` const, `CHECK_REDACTION`) but worth a comment.                                                                                                                                                                                                                |
| 10  | Low      | Maintainability | `result-extensions/src/handle-grpc-call.ts`                        | **`handleGrpcCall` maps ALL gRPC `ServiceError` codes to a single `SERVICE_UNAVAILABLE` result.** gRPC has 17 status codes including `NOT_FOUND`, `PERMISSION_DENIED`, etc. Intentional fail-safe but could provide richer error info.                                                                                                                                                        |

---

**TLC folder convention verification**: All files follow the TLC→2LC→3LC convention correctly. Verified all 16 handler files are in the correct Q/R/C/U/D subdirectories.

---

**Tests to add**:

- [ ] `DistributedCache.IPingHandler` — no type-contract test exists
- [ ] `Messaging.IPingHandler` — no type-contract test exists
- [ ] `DistributedCache.ISetNxHandler` — no interface-level type-contract test (only integration tests)
- [ ] `RateLimit.ICheckHandler` — no interface-level type-contract test
- [ ] `Idempotency.ICheckHandler` — no interface-level type-contract test
- [ ] `IRequestInfo` — no dedicated test (32-line interface with 14 properties)
- [ ] `handleGrpcCall` edge case: `resultSelector` returning `undefined` — should produce `unhandledException` not unhandled throw

**Tests to remove**:

- (none — all existing tests are valid)

---

**Cross-package alignment summary**: Both packages are clean and well-structured. All 8 implementation packages correctly implement their respective interfaces. The most notable finding is the missing `isTrustedService` on Node.js `IRequestInfo` (Finding #1) — a feature gap vs. .NET.
