# Tests

Integration and unit tests for shared infrastructure including cache implementations, result pattern, handler behavior, logging redaction, and extensions.

## Files

| File Name                                                                                         | Description                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TestHelpers.cs](TestHelpers.cs)                                                                  | Test utilities creating mock IHandlerContext and IRequestContext instances with test trace IDs for handler testing.                                                                                                     |
| [RedisDistributedCacheTests.cs](Integration/RedisDistributedCacheTests.cs)                        | Integration tests using Testcontainers.Redis to validate Set/Get/Remove/Exists operations with real Redis instance, JSON serialization, and TTL expiration.                                                             |
| [D2ResultTests.cs](Unit/D2ResultTests.cs)                                                         | Unit tests for non-generic D2Result class verifying factory methods (Ok, Fail, ValidationFailed, NotFound, Forbidden, Unauthorized, Conflict, UnhandledException) with proper status codes, error codes, and trace IDs. |
| [D2ResultGenericTests.cs](Unit/D2ResultGenericTests.cs)                                           | Unit tests for generic D2Result<TData> class testing factory methods with data payloads, CheckSuccess/CheckFailure helper methods for pattern matching, and BubbleFail for error propagation across result types.       |
| [DefaultMemoryCacheTests.cs](Unit/DefaultMemoryCacheTests.cs)                                     | Unit tests for DefaultMemoryCacheService verifying Get/GetMany (missing/existing keys), Set/SetMany (with/without expiration), and Remove operations using IMemoryCache.                                                |
| [StringExtensionsTests.cs](Unit/StringExtensionsTests.cs)                                         | Unit tests verifying Truthy/Falsey, CleanStr normalization, email validation, phone number cleaning, and hash string generation.                                                                                        |
| [EnumerableExtensionsTests.cs](Unit/EnumerableExtensionsTests.cs)                                 | Unit tests for collection Truthy/Falsey checks and Clean operations with various null handling and empty enumerable behaviors.                                                                                          |
| [GuidExtensionsTests.cs](Unit/GuidExtensionsTests.cs)                                             | Unit tests validating GUID Truthy/Falsey behavior for both nullable and non-nullable GUIDs, including empty and default values.                                                                                         |
| [BatchOptionsTests.cs](Unit/BatchPg/BatchOptionsTests.cs)                                         | Unit tests verifying BatchOptions default values (BatchSize=500, AsNoTracking=true) and custom configuration.                                                                                                           |
| [DefaultOptionsTests.cs](Unit/Handler/DefaultOptionsTests.cs)                                     | Unit tests for BaseHandler.DefaultOptions virtual property: default behavior, override, per-call override precedence, null fallthrough, partial overrides, debug-disabled loggers, and exception path.                  |
| [RedactDataDestructuringPolicyTests.cs](Unit/Logging/RedactDataDestructuringPolicyTests.cs)       | Unit tests for Serilog RedactDataDestructuringPolicy: type-level/property-level redaction, custom reasons, null properties, type+property precedence, inheritance, caching, mixed reasons, default reason.              |
| [AuthPolicyTests.cs](Unit/Gateway/AuthPolicyTests.cs)                                             | Unit tests for auth constants (RoleValues.AtOrAbove, OrgTypeValues), D2 authorization policies (AddD2Policies, RequireOrgType, RequireRole, RequireOrgTypeAndRole).                                                     |
| [JwtFingerprintValidatorTests.cs](Unit/Gateway/JwtFingerprintValidatorTests.cs)                   | Unit tests for JWT fingerprint SHA-256(UA\|Accept) computation, cross-platform parity, null/empty inputs, and header variations.                                                                                        |
| [JwtFingerprintMiddlewareTests.cs](Unit/Gateway/JwtFingerprintMiddlewareTests.cs)                 | Unit tests for JWT fingerprint middleware: match/mismatch, no fp claim, no auth context, case-insensitive headers, D2Result error body, short claim.                                                                    |
| [RequestContextJwtTests.cs](Unit/Gateway/RequestContextJwtTests.cs)                               | Unit tests for RequestContext JWT claim extraction: all claim types, OrgType mapping, missing claims, target header, impersonation/emulation.                                                                           |
| [RequestContextDeriveRelationshipTests.cs](Unit/Gateway/RequestContextDeriveRelationshipTests.cs) | Unit tests for DeriveRelationship: all 5 relationship branches, edge cases, null HttpContext.                                                                                                                           |
| [RequestContextOrgEmulationTests.cs](Unit/Gateway/RequestContextOrgEmulationTests.cs)             | Unit tests for org emulation: emulation claim parsing, isEmulating flag, emulated org context.                                                                                                                          |
| [ServiceKeyEndpointFilterTests.cs](Unit/Gateway/ServiceKeyEndpointFilterTests.cs)                 | Unit tests for ServiceKeyEndpointFilter: valid/invalid/missing keys, case sensitivity, multiple keys.                                                                                                                   |
| [D2RetryHelperTests.cs](Unit/Retry/D2RetryHelperTests.cs)                                         | Unit tests for D2RetryHelper: exponential backoff, transient error detection, max retries, abort on non-transient.                                                                                                      |
| [CheckHandlerTests.cs](Unit/Middleware/Idempotency/CheckHandlerTests.cs)                          | Unit tests for idempotency Check handler: SET NX, sentinel detection, cached response replay, fail-open.                                                                                                                |
| [IdempotencyMiddlewareTests.cs](Unit/Middleware/Idempotency/IdempotencyMiddlewareTests.cs)        | Unit tests for idempotency middleware: end-to-end flow, 409 on in-flight, response caching, header extraction.                                                                                                          |

---

## Testing Philosophy & Best Practices

High line coverage with only happy-path tests is insufficient. Every feature must be tested adversarially — code coverage AND case coverage are both required.

### Case Coverage Checklist

Apply to ALL test layers (xUnit, Vitest, Playwright):

| Category                    | What to Test                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Happy path**              | Valid inputs produce expected outputs                                                                             |
| **Invalid/garbage inputs**  | Nulls, empty strings, whitespace-only, wrong types, negative numbers, zero-length arrays                         |
| **Boundary values**         | Max length strings, exactly-at-limit, one-over-limit, empty collections                                         |
| **Format violations**       | Malformed emails, invalid UUIDs, bad date formats, non-UTF8                                                      |
| **Cross-field dependencies**| Field A valid alone but invalid given field B's value                                                             |
| **Error propagation**       | Upstream failures (gRPC down, Redis timeout, DB constraint violation) handled gracefully, not swallowed or 500'd |
| **Idempotency**             | Same operation twice produces same result (especially for handlers with side effects)                            |
| **Concurrency**             | Concurrent identical requests don't corrupt state (singleflight, circuit breaker, cache races)                   |

### Test Naming

Use descriptive names that explain the scenario — class/method under test, condition, expected outcome:

```csharp
GetHandler_WhenMemoryCacheHit_ReturnsDataWithoutCallingRedis
Create_WithValidCoordinates_GeneratesConsistentHashId
SetHandler_WhenRedisUnavailable_ReturnsServiceUnavailable
Validate_WithWhitespaceOnlyEmail_ReturnsValidationError
```

### Form / Endpoint Testing

For API endpoints and Playwright E2E tests:

- Submit with all fields empty — validation fires, no server round-trip
- Submit with one invalid field — only that field shows error, others preserved
- Fix error, re-blur/re-submit — error clears
- Whitespace-only inputs rejected (not silently accepted)
- Max-length enforcement (paste 10,000 chars — truncated or rejected)

### Principle

If code accepts user input or external data, try to **break it**. If it doesn't break, the tests prove it. If it does break, the test catches it before production does.

### Frameworks

| Platform  | Frameworks                                                           |
| --------- | -------------------------------------------------------------------- |
| .NET      | xUnit, FluentAssertions, Moq, Testcontainers (PostgreSQL 18, Redis) |
| Node.js   | Vitest 4.x, Testcontainers (PostgreSQL + Redis modules)             |
| SvelteKit | vitest-browser-svelte (components), Playwright (E2E)                 |
