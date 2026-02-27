# Deep Dive Sweep Findings

Second sweep: cross-cutting thematic analysis across the entire codebase. 21 agents, 8 phases.

---

## Summary Table

| Severity  | Original | Fixed (R1+R2) | Reverted | False Positive | Remaining Open      |
| --------- | -------- | ------------- | -------- | -------------- | ------------------- |
| P1        | 9        | 4             | 1        | 0              | 4 (deferred)        |
| P2        | 36       | 8             | 0        | 5              | 23                  |
| P3        | 28       | 5             | 0        | 4              | 19                  |
| **Total** | **73**   | **17**        | **1**    | **9**          | **46 + 2 won't-do** |

**P1 Fixed (Round 1):** Drizzle rowCount validation (6 handlers), consumer + handler schema alignment (3 files), consumer prefetchCount default, BaseHandler PII span tags.

**P1 Reverted (false positive):** RetryHelper catch filter — original `||` form was correct (De Morgan's equivalence).

**P1 Deferred (architectural):** HIBP on password reset, geoClient `undefined as never` guard, email provider unconditional resolve, Geo health monitoring.

**Round 2 Fixed:** Service key timing-safe comparison, security headers (.NET + Node), exception handler detail stripping, CancellationToken propagation, FK violation handler, IP address redaction, channel resolution error details, markdown rendering try/catch, OTel span recording in Hono error handler, health endpoint rate limit bypass.

**Round 2 False Positives:** DI `build()` freeze (correct by design), DI duplicate key (expected last-wins), DI transitive cycle detection (correctly detects all cycles), DI scope disposal (correctly clears), AbortSignal `{ once: true }` (already present), `safe-stringify` recursion depth (file doesn't exist), 429 status code mapping (generic cast handles it), trusted service rate limit bypass (already implemented).

---

## Phase 1: Auth/AuthZ Deep Audit

### Agent 1A: Auth Session Lifecycle

| #   | Sev    | Finding                                           | File                              | Status                                                             |
| --- | ------ | ------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| 1   | P1     | HIBP breach check missing on password reset       | auth hooks (architectural)        | Deferred                                                           |
| 2   | P2     | Redis secondary storage fail-open not documented  | auth-infra `secondary-storage.ts` | Open                                                               |
| 3   | P2     | Session update hook lacks org membership re-check | auth-infra `auth-hooks.ts`        | Open                                                               |
| 4   | P2     | `forceAllowId: true` surface area review          | auth-infra `auth-factory.ts`      | Open                                                               |
| 5   | P2     | Emulation consent expiry not enforced on session  | auth-app emulation handlers       | Open                                                               |
| 6   | ~~P3~~ | ~~Cookie `sameSite` default not explicitly set~~  | auth-infra `auth-config.ts`       | False positive — `sameSite: "lax"` is set in `auth-factory.ts:166` |
| 7   | P3     | Session cookie name is default (fingerprintable)  | auth-infra `auth-config.ts`       | Open                                                               |
| 8   | P3     | Sign-in event logging doesn't record failure type | auth-infra `auth-hooks.ts`        | Open                                                               |

### Agent 1B: Auth Route Authorization

**CLEAN** — all 19 checklist items passed. IDOR prevention, CSRF, auth middleware, rate limiting, body size limits all correctly applied.

### Agent 1C: .NET Gateway JWT/AuthZ

| #   | Sev | Finding                                                | File                      | Status                                                               |
| --- | --- | ------------------------------------------------------ | ------------------------- | -------------------------------------------------------------------- |
| 1   | P2  | Service key comparison uses `HashSet.Contains()`       | `ServiceKeyMiddleware.cs` | Fixed (R2) — timing-safe `CryptographicOperations.FixedTimeEquals()` |
| 2   | P2  | JWKS cache no fallback when auth service unreachable   | `JwtAuthExtensions.cs`    | Open                                                                 |
| 3   | P3  | Missing `X-Content-Type-Options: nosniff` header       | REST gateway `Program.cs` | Fixed (R2) — headers added + Hono parity                             |
| 4   | P3  | Health endpoint exempt from auth but not rate limiting | REST gateway endpoints    | Fixed (R2) — path bypass in RateLimitMiddleware                      |

### Agent 1D: Cross-Platform Auth Parity

**CLEAN** — fingerprint algorithm, OrgType enum, role hierarchy, JWT claims, trust flag semantics all consistent between Node.js and .NET.

| #   | Sev | Finding                                         | File | Status |
| --- | --- | ----------------------------------------------- | ---- | ------ |
| 1   | P2  | Parity checks not documented in architecture MD | —    | Open   |

---

## Phase 2: Data Integrity and Persistence

### Agent 2A: Node.js Drizzle Schema + Repositories

| #   | Sev | Finding                                                       | File(s)                                                                                                                                                                                             | Status                                         |
| --- | --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | P1  | UPDATE handlers don't check rowCount (silent no-op)           | auth: `update-org-contact-record.ts`, `revoke-emulation-consent-record.ts`; comms: `update-delivery-attempt-status.ts`, `update-channel-preference-record.ts`, `mark-delivery-request-processed.ts` | Fixed                                          |
| 2   | P1  | DELETE handler doesn't check rowCount                         | auth: `delete-org-contact-record.ts`                                                                                                                                                                | Fixed                                          |
| 3   | P2  | No transaction wrapping on multi-step org-contact ops         | auth-infra `create-org-contact` flow                                                                                                                                                                | Open                                           |
| 4   | P2  | `pg-errors.ts` only catches `23505`, not `23503`              | auth-infra `pg-errors.ts`                                                                                                                                                                           | Fixed (R2) — `isPgForeignKeyViolation()` added |
| 5   | P2  | Migration ordering not enforced by naming convention          | auth-infra + comms-infra migrations                                                                                                                                                                 | Open                                           |
| 6   | P3  | No index on `org_contact.organization_id`                     | auth-infra schema                                                                                                                                                                                   | Open                                           |
| 7   | P3  | `deliveryAttempt.set(updates)` uses `Record<string, unknown>` | comms-infra `update-delivery-attempt-status.ts`                                                                                                                                                     | Open                                           |

### Agent 2B: .NET EF Core Repository + Entity Integrity

**CLEAN** — all checklist items passed. Content-addressable hashing, batch atomicity, DbContext scoping, cascade behavior, AsNoTracking, PredicateBuilder all correct.

### Agent 2C: Cache Coherence Across Tiers

| #   | Sev | Finding                                                      | File(s)                             | Status |
| --- | --- | ------------------------------------------------------------ | ----------------------------------- | ------ |
| 1   | P2  | No explicit cache invalidation on write (auth)               | auth handlers + cache layers        | Open   |
| 2   | P2  | Memory + Redis TTL misalignment possible                     | cache-memory vs cache-redis configs | Open   |
| 3   | P3  | Thundering herd on popular key expiry (no lock/singleflight) | cache-memory `get.ts`               | Open   |
| 4   | P3  | Negative caching (NOT_FOUND) not implemented                 | geo-client cache handlers           | Open   |
| 5   | P3  | Cross-platform Redis key prefix not documented               | cache-redis config                  | Open   |
| 6   | P3  | LRU eviction under high concurrency not stress-tested        | cache-memory store                  | Open   |

---

## Phase 3: Service Boundaries and Communication

### Agent 3A: gRPC Service Layer

| #   | Sev | Finding                                                    | File(s)                | Status |
| --- | --- | ---------------------------------------------------------- | ---------------------- | ------ |
| 1   | P2  | No explicit gRPC deadline/timeout on client calls          | comms-api gRPC service | Open   |
| 2   | P3  | Proto field number gaps not documented                     | `contracts/protos/`    | Open   |
| 3   | P3  | Unimplemented RPCs return generic error, not UNIMPLEMENTED | comms-api gRPC service | Open   |

### Agent 3B: RabbitMQ Messaging

| #   | Sev | Finding                                                                   | File(s)                               | Status |
| --- | --- | ------------------------------------------------------------------------- | ------------------------------------- | ------ |
| 1   | P2  | Consumer Zod schema was looser than handler (uuid + limits aligned)       | `notification-consumer.ts`            | Fixed  |
| 2   | P2  | prefetchCount now configurable with default 1 (was undefined → unlimited) | `notification-consumer.ts`            | Fixed  |
| 3   | P2  | No DLQ for messages exhausting all retry tiers                            | `notification-consumer.ts:122-124`    | Open   |
| 4   | P2  | Publisher confirms not explicitly enabled                                 | comms-client + messaging `MessageBus` | Open   |
| 5   | P2  | Connection recovery backoff not configurable                              | messaging `MessageBus`                | Open   |

### Agent 3C: Inter-Service Data Flow

| #   | Sev | Finding                                                     | File(s)                           | Status   |
| --- | --- | ----------------------------------------------------------- | --------------------------------- | -------- |
| 1   | P1  | `undefined as never` geoClient cast (runtime crash if used) | comms composition root            | Deferred |
| 2   | P1  | No Geo health check before gRPC calls (silent failure)      | comms-api + auth hooks            | Deferred |
| 3   | P2  | RabbitMQ down → verification email lost (no outbox pattern) | auth hooks → comms-client         | Open     |
| 4   | P2  | No circuit breaker on Geo gRPC calls                        | geo-client gRPC handlers          | Open     |
| 5   | P3  | Service startup ordering not enforced in Aspire             | AppHost                           | Open     |
| 6   | P3  | No readiness probe on RabbitMQ consumer                     | comms-api startup                 | Open     |
| 7   | P3  | Idempotency key not propagated through retry pipeline       | notification-consumer retry logic | Open     |

---

## Phase 4: Error Handling and Resilience

### Agent 4A: Node.js Error Paths

| #   | Sev    | Finding                                                   | File(s)                         | Status                                                                  |
| --- | ------ | --------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| 1   | ~~P2~~ | ~~AbortSignal listeners missing `{ once: true }`~~        | Various signal handlers         | False positive — already present in retry.ts + retry-result.ts          |
| 2   | P2     | Graceful shutdown doesn't drain RabbitMQ consumer         | comms-api shutdown              | Open                                                                    |
| 3   | P2     | Redis connection error not surfaced to health check       | cache-redis handlers            | Open                                                                    |
| 4   | ~~P3~~ | ~~`safeStringify` recursion depth not configurable~~      | utilities `safe-stringify.ts`   | False positive — file does not exist in codebase                        |
| 5   | P3     | Hono error handler logs but doesn't set trace span error  | auth-api error middleware       | Fixed (R2) — `trace.getActiveSpan().recordException()` added            |
| 6   | P3     | Channel resolution failure doesn't indicate which channel | comms-app `resolve-channels.ts` | Fixed (R2) — error details include attempted/skipped channels           |
| 7   | P3     | Markdown rendering failure returns 500 not 422            | comms-app `render-html.ts`      | Fixed (R2) — try/catch returns DispatchResult error instead of throwing |

### Agent 4B: .NET Error Paths

| #   | Sev    | Finding                                                                 | File(s)                 | Status                                                                   |
| --- | ------ | ----------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| 1   | ~~P1~~ | ~~RetryHelper catch filter — false positive (De Morgan's equivalence)~~ | `RetryHelper.cs:110`    | Reverted                                                                 |
| 2   | P2     | CancellationToken not propagated in some middleware                     | Various .NET middleware | Fixed (R2) — `context.RequestAborted` added to ServiceKeyMiddleware      |
| 3   | ~~P2~~ | ~~`ResultExtensions` doesn't map 429 status code~~                      | `ResultExtensions.cs`   | False positive — generic `(int)result.StatusCode` cast handles all codes |
| 4   | P2     | Gateway exception handler leaks exception details in dev mode           | REST gateway middleware | Fixed (R2) — `AddProblemDetails` strips Detail in non-dev                |
| 5   | P3     | RetryHelper `CalculateDelay` can overflow on high retryIndex            | `RetryHelper.cs`        | Open                                                                     |
| 6   | P3     | Batch query doesn't log which chunk failed                              | `BatchQuery.cs`         | Open                                                                     |

---

## Phase 5: DI Container and Lifecycle

### Agent 5A: DI Container Core

| #   | Sev    | Finding                                                    | File(s)                     | Status                                                                 |
| --- | ------ | ---------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| 1   | ~~P2~~ | ~~No transitive circular dependency detection~~            | `@d2/di` resolve logic      | False positive — correctly detects all cycles including transitive     |
| 2   | ~~P2~~ | ~~`ServiceCollection.build()` doesn't freeze descriptors~~ | `@d2/di` service-collection | False positive — `_descriptors` Map set once, never exposed mutably    |
| 3   | ~~P2~~ | ~~Duplicate key registration silently overwrites~~         | `@d2/di` service-collection | False positive — expected last-wins, matches .NET `IServiceCollection` |
| 4   | ~~P2~~ | ~~Scope disposal doesn't clear `_scopedCache` references~~ | `@d2/di` service-scope      | False positive — `dispose()` correctly clears all refs                 |
| 5   | P3     | No debug logging for DI resolution (hard to troubleshoot)  | `@d2/di`                    | Open                                                                   |
| 6   | P3     | `setInstance` accepts any value type (no type checking)    | `@d2/di` service-scope      | Open                                                                   |

### Agent 5B: Composition Roots

| #   | Sev | Finding                                                                 | File(s)                | Status   |
| --- | --- | ----------------------------------------------------------------------- | ---------------------- | -------- |
| 1   | P1  | Email provider resolves unconditionally (crashes without config)        | comms composition root | Deferred |
| 2   | P2  | Singleton handlers receive root provider (expected, but not documented) | composition root docs  | Open     |
| 3   | P2  | E2E test wiring diverges from production (stub providers)               | e2e test helpers       | Open     |

---

## Phase 6: Observability

### Agent 6A: Tracing + Metrics

| #   | Sev | Finding                                                   | File(s)                      | Status |
| --- | --- | --------------------------------------------------------- | ---------------------------- | ------ |
| 1   | P1  | PII (userId, orgId) unconditionally set on span tags      | `BaseHandler.cs:79-81`       | Fixed  |
| 2   | P1  | HTTP request ID not propagated as span attribute          | .NET middleware              | Open   |
| 3   | P2  | W3C trace context not explicitly verified across gRPC     | service-defaults + gRPC      | Open   |
| 4   | P2  | Metric label cardinality review needed (handler names OK) | All metrics                  | Open   |
| 5   | P3  | No custom span events for retry/fallback paths            | RetryHelper + cache handlers | Open   |

### Agent 6B: Logging + Redaction

| #   | Sev | Finding                                                      | File(s)                     | Status                                                                  |
| --- | --- | ------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------- |
| 1   | P2  | RedactionSpec not defined on all PII-handling handlers       | Various auth/comms handlers | Open                                                                    |
| 2   | P2  | Sign-in event IP address logged without redaction            | auth-infra `auth-hooks.ts`  | Fixed (R2) — IP redacted (last octet masked) before passing to onSignIn |
| 3   | P2  | Error logs sometimes missing traceId context                 | Various error paths         | Open                                                                    |
| 4   | P3  | No structured logging standard for cross-service correlation | Logging config              | Open                                                                    |

---

## Phase 7: Dependencies

### Agent 7A: Node.js Dependencies

**CLEAN** — all versions exact-pinned, no `^`/`~`, pnpm audit clean, no unused deps, license compliant.

### Agent 7B: .NET Dependencies

| #   | Sev | Finding                                                     | File(s)                 | Status |
| --- | --- | ----------------------------------------------------------- | ----------------------- | ------ |
| 1   | P2  | `Directory.Build.props` doesn't enforce version consistency | Solution root           | Open   |
| 2   | P2  | Some test packages not pinned to exact versions             | Various `.csproj` files | Open   |
| 3   | P3  | FluentValidation version behind latest stable               | Shared packages         | Open   |
| 4   | P3  | No `dotnet outdated` in CI pipeline                         | CI config               | Open   |

---

## Phase 8: Test Quality

### Agent 8A: Shared Package Tests

| #   | Sev | Finding                                                  | File(s)                  | Status |
| --- | --- | -------------------------------------------------------- | ------------------------ | ------ |
| 1   | P2  | Cache-memory LRU eviction edge case not tested (0 max)   | shared-tests cache tests | Open   |
| 2   | P3  | Some mocks don't verify call counts (only call presence) | Various shared tests     | Open   |
| 3   | P3  | No negative-path test for DI circular dependency         | shared-tests di tests    | Open   |

### Agent 8B: Auth + Comms Tests

| #   | Sev | Finding                                                     | File(s)                  | Status |
| --- | --- | ----------------------------------------------------------- | ------------------------ | ------ |
| 1   | P2  | No test for UPDATE/DELETE rowCount=0 → notFound             | auth-tests + comms-tests | Open   |
| 2   | P2  | No test for consumer schema validation rejection            | comms-tests              | Open   |
| 3   | P2  | No test for retry tier exhaustion (max attempts)            | comms-tests              | Open   |
| 4   | P2  | No concurrent access test for channel preference updates    | comms-tests              | Open   |
| 5   | P2  | Middleware chain order not tested end-to-end                | auth-tests               | Open   |
| 6   | P2  | Hook integration tests use mocks instead of real BetterAuth | auth-tests               | Open   |
| 7   | P2  | Delivery pipeline E2E doesn't test retry path               | e2e-tests                | Open   |
| 8   | P2  | No test for graceful shutdown behavior                      | comms-tests              | Open   |
| 9   | P2  | No test for Redis connection failure fallback               | auth-tests + comms-tests | Open   |
| 10  | P2  | No test for email provider unavailable scenario             | comms-tests              | Open   |
| 11  | P3  | Test helper fixtures not shared between auth and comms      | test infrastructure      | Open   |
| 12  | P3  | No property-based tests for schema validation               | auth-tests + comms-tests | Open   |
| 13  | P3  | Integration test containers not reused across test files    | auth-tests + comms-tests | Open   |
| 14  | P3  | Some test descriptions don't match actual assertions        | Various test files       | Open   |
| 15  | P3  | No snapshot tests for gRPC proto mapping                    | comms-tests              | Open   |

### Agent 8C: .NET Tests

**CLEAN** — Testcontainer usage correct, Moq verify comprehensive, parallelism safe, xUnit cleanup proper.

---

## P1 Fixes Applied

### Fix 1: Drizzle UPDATE/DELETE rowCount validation (6 files)

**Before:** `await this.db.update(table).set({...}).where(...); return D2Result.ok({});`

**After:** Added `.returning({ id: table.id })` and check `rows.length === 0` → `D2Result.notFound()`.

**Files changed:**

- `auth/infra/src/repository/handlers/u/update-org-contact-record.ts`
- `auth/infra/src/repository/handlers/d/delete-org-contact-record.ts`
- `auth/infra/src/repository/handlers/u/revoke-emulation-consent-record.ts`
- `comms/infra/src/repository/handlers/u/update-delivery-attempt-status.ts`
- `comms/infra/src/repository/handlers/u/update-channel-preference-record.ts`
- `comms/infra/src/repository/handlers/u/mark-delivery-request-processed.ts`

### Fix 2: Consumer + Handler Zod schemas aligned with domain/DB

**Consumer (notification-consumer.ts):**

- `recipientContactId`: `z.string().min(1).max(64)` → `z.string().uuid()`
- `title`: `max(500)` → `max(255)` (matches `THREAD_CONSTRAINTS.MAX_TITLE_LENGTH`)
- `correlationId`: `max(64)` → `max(36)` (UUID length)
- `senderService`: `max(100)` → `max(50)` (matches DB `varchar(50)`)

**Deliver handler (deliver.ts):**

- `title`: `max(500)` → `max(255)` (pre-existing bug — exceeded DB column limit)
- `senderService`: `max(100)` → `max(50)` (pre-existing bug — exceeded DB column limit)

**Files:** `comms/infra/src/messaging/consumers/notification-consumer.ts`, `comms/app/src/implementations/cqrs/handlers/x/deliver.ts`

### Fix 3: Consumer prefetchCount configurable with default 1

**Before:** No QoS setting (rabbitmq-client defaults to unlimited if not set)

**After:** `prefetchCount` is a configurable dep parameter with default `1`, matching .NET `ConsumerConfig.PrefetchCount` default. Consumer processes messages sequentially — prefetch > 1 provides no throughput benefit.

**File:** `comms/infra/src/messaging/consumers/notification-consumer.ts`

### ~~Fix 4: RetryHelper catch filter logic~~ (REVERTED — false positive)

The original form `ex is not OperationCanceledException || !ct.IsCancellationRequested` is correct by De Morgan's law: `!A || !B` ≡ `!(A && B)`. The sweep agent incorrectly identified this as a bug. No change needed.

**File:** `Utilities/Retry/RetryHelper.cs:110` — reverted to original

### Fix 4: BaseHandler PII span tags guarded

**Before:** `activity?.SetTag("user.id", Context.Request.UserId);` (unconditional, sets null values)

**After:** Null-checked before setting: `if (Context.Request.UserId is not null) { activity?.SetTag(...); }`

**File:** `Handler/BaseHandler.cs:79-81`

### Fix 5: Test fixtures updated for tightened consumer schema

Comms integration tests used non-UUID values for `recipientContactId` (e.g., `"contact-1"`). Updated all test fixtures to valid UUIDs to match the tightened `z.string().uuid()` consumer schema.

**File:** `comms/tests/src/integration/notification-consumer.test.ts`

---

## Round 2 Fixes Applied

### Fix R2-1: Service key timing-safe comparison [SECURITY]

**Before:** `HashSet<string>.Contains()` — O(1) but timing reveals key length/prefix via hash bucket lookup.

**After:** `CryptographicOperations.FixedTimeEquals()` loop over ALL keys (always iterates every key to prevent timing side-channel). Backing store changed from `HashSet<string>` to `byte[][]`.

**File:** `backends/dotnet/gateways/REST/Auth/ServiceKeyMiddleware.cs`

### Fix R2-2: Security headers on .NET gateway + Auth Hono API

Added `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` to both browser-facing services:

- .NET REST gateway: inline middleware before `UseExceptionHandler()`
- Auth Hono API: middleware in composition root after CORS

**Files:** `backends/dotnet/gateways/REST/Program.cs`, `backends/node/services/auth/api/src/composition-root.ts`

### Fix R2-3: Exception handler detail stripping in non-dev

**Before:** `AddProblemDetails()` with defaults — `Detail` could contain exception info in all environments.

**After:** `CustomizeProblemDetails` strips `Detail` and sets generic `Title` when not `IsDevelopment()`.

**File:** `backends/dotnet/gateways/REST/Program.cs`

### Fix R2-4: CancellationToken propagation in ServiceKeyMiddleware

Added `context.RequestAborted` to `WriteAsJsonAsync()` call for proper cancellation support.

**File:** `backends/dotnet/gateways/REST/Auth/ServiceKeyMiddleware.cs`

### Fix R2-5: FK violation handler in pg-errors.ts

Added `isPgForeignKeyViolation()` function checking PostgreSQL error code `23503`. Available for use in handlers that create junction records (org-contact creation).

**File:** `backends/node/services/auth/infra/src/repository/utils/pg-errors.ts`

### Fix R2-6: IP address redaction in sign-in hooks

**Before:** Raw IP address passed directly to `onSignIn` callback.

**After:** IP redacted before passing — last octet masked for IPv4 (`192.168.1.***`), last segment for IPv6 (`2001:db8::***`).

**File:** `backends/node/services/auth/infra/src/auth/better-auth/auth-factory.ts`

### Fix R2-7: Channel resolution error details

**Before:** Generic `"No deliverable address found for any resolved channel."` message.

**After:** Error message includes which channels were attempted and why each was skipped (e.g., `"sms: no phone number on contact"`, `"email: no dispatcher configured"`). Also logs warnings for skipped channels.

**File:** `backends/node/services/comms/app/src/implementations/cqrs/handlers/x/deliver.ts`

### Fix R2-8: Markdown rendering try/catch

**Before:** `renderMarkdownToHtml()` could throw, causing 503 retry instead of terminal failure.

**After:** Wrapped in try/catch. On failure, returns `DispatchResult` with error message instead of throwing (terminal failure, no retry).

**File:** `backends/node/services/comms/app/src/implementations/cqrs/handlers/x/channel-dispatchers.ts`

### Fix R2-9: OTel span recording in Hono error handler

Added `trace.getActiveSpan()` → `span.recordException(err)` + `span.setStatus({ code: SpanStatusCode.ERROR })`. No-op without registered OTel provider (safe in tests).

Cross-platform parity verified: .NET ServiceDefaults already sets `RecordException = true` on ASP.NET Core instrumentation.

**File:** `backends/node/services/auth/api/src/middleware/error-handler.ts`

### Fix R2-10: Health endpoint bypasses rate limiting

Added path check for `/api/health` at the top of `RateLimitMiddleware.InvokeAsync()`. Health endpoints should never be rate-limited (they're used for readiness/liveness probes and would create false positives).

**File:** `backends/dotnet/shared/Implementations/Middleware/RateLimit.Default/RateLimitMiddleware.cs`

---

## Remaining Open Items — Triage (51 items)

4 deferred P1 + 23 open P2 + 20 open P3 = 47 open from phases. Plus 4 deferred = 51 total remaining.

Note: E1 below was investigated and found stale — `sameSite: "lax"` IS explicitly set in `auth-factory.ts:166`. Reclassified as false positive, reducing true remaining to **50**.

---

### Category A: Deferred P1 (4 items — need design decisions)

| #   | Ref  | Finding                                 | Owner | Complexity | Notes                                                          |
| --- | ---- | --------------------------------------- | ----- | ---------- | -------------------------------------------------------------- |
| A1  | 1A#1 | HIBP breach check on password reset     | Auth  | Medium     | BetterAuth hook needed. Sign-up already checks — reset doesn't |
| A2  | 3C#1 | geoClient `undefined as never` guard    | Comms | Low        | Fail-fast at startup vs optional. Quick fix once decided       |
| A3  | 5B#1 | Email provider unconditional resolve    | Comms | Low        | Lazy resolution or startup validation. Quick fix once decided  |
| A4  | 3C#2 | Geo health monitoring before gRPC calls | All   | High       | Circuit breaker + health probe — real infra work               |

### Category B: Resilience / Infrastructure (8 items — need discussion)

| #   | Ref  | Finding                                       | Complexity | Notes                                            |
| --- | ---- | --------------------------------------------- | ---------- | ------------------------------------------------ |
| B1  | 1C#2 | JWKS cache fallback when auth unreachable     | Medium     | In-memory cache + stale fallback strategy        |
| B2  | 3B#3 | No DLQ for retry-exhausted messages           | Medium     | Topology design + monitoring/replay              |
| B3  | 3B#4 | Publisher confirms not enabled                | Low        | One-line config, but needs error handling design |
| B4  | 3B#5 | Connection recovery backoff not configurable  | Low        | Expose existing rabbitmq-client config           |
| B5  | 3C#3 | RabbitMQ down → verification email lost       | High       | Outbox pattern — major architectural change      |
| B6  | 3C#4 | No circuit breaker on Geo gRPC calls          | Medium     | Overlaps A4                                      |
| B7  | 4A#2 | Graceful shutdown doesn't drain consumer      | Medium     | MessageBus API changes, timeout strategy         |
| B8  | 4A#3 | Redis connection error not surfaced to health | Low        | Wire PingCache error into health response        |

### Category C: Documentation / Convention (5 items — quick docs work)

| #   | Ref  | Finding                                                      | Effort |
| --- | ---- | ------------------------------------------------------------ | ------ |
| C1  | 1A#2 | Redis secondary storage fail-open not documented             | Tiny   |
| C2  | 1D#1 | Parity checks not documented in architecture MD              | Small  |
| C3  | 2A#5 | Migration ordering not enforced by naming convention         | Small  |
| C4  | 5B#2 | Singleton handlers receive root provider (not documented)    | Tiny   |
| C5  | 6B#4 | No structured logging standard for cross-service correlation | Small  |

### Category D: Code Quality / Hardening (15 items — do when touching the area)

| #   | Ref  | Finding                                                      | Effort | Notes                                          |
| --- | ---- | ------------------------------------------------------------ | ------ | ---------------------------------------------- |
| D1  | 1A#3 | Session update hook lacks org membership re-check            | Medium | Security vs perf — gateway already checks      |
| D2  | 1A#4 | `forceAllowId: true` surface area review                     | Small  | Audit, not code change                         |
| D3  | 1A#5 | Emulation consent expiry not enforced on session             | Medium | TTL check in session hook                      |
| D4  | 2A#3 | No transaction wrapping on multi-step org-contact ops        | Medium | Drizzle transaction wrapper                    |
| D5  | 2C#1 | No explicit cache invalidation on write (auth)               | Medium | Intentional (TTL-based), revisit at scale      |
| D6  | 2C#2 | Memory + Redis TTL misalignment possible                     | Small  | Config review + docs                           |
| D7  | 3A#1 | No explicit gRPC deadline/timeout on client calls            | Small  | Add default deadline to gRPC call sites        |
| D8  | 4B#5 | RetryHelper `CalculateDelay` can overflow on high retryIndex | Tiny   | `Math.Min` clamp                               |
| D9  | 4B#6 | Batch query doesn't log which chunk failed                   | Tiny   | Add chunk index to log                         |
| D10 | 6A#2 | HTTP request ID not propagated as span attribute             | Small  | TraceIdentifier → span attribute in middleware |
| D11 | 6A#3 | W3C trace context not verified across gRPC                   | Small  | Test/document OTel propagation                 |
| D12 | 6A#4 | Metric label cardinality review needed                       | Small  | Audit only                                     |
| D13 | 6B#1 | RedactionSpec not defined on all PII-handling handlers       | Medium | Add redaction specs to auth/comms handlers     |
| D14 | 6B#3 | Error logs sometimes missing traceId context                 | Small  | Audit + fix individual log calls               |
| D15 | 7B#1 | `Directory.Build.props` doesn't enforce version consistency  | Small  | Central package management                     |

### Category E: Nice-to-Have / Polish (15 items — P3 lowest priority)

| #   | Ref  | Finding                                                                          |
| --- | ---- | -------------------------------------------------------------------------------- |
| E1  | 1A#6 | ~~Cookie `sameSite` not explicitly set~~ — FALSE POSITIVE (already set to `lax`) |
| E2  | 1A#7 | Session cookie name is default (fingerprintable)                                 |
| E3  | 1A#8 | Sign-in event logging doesn't record failure type                                |
| E4  | 2A#6 | No index on `org_contact.organization_id`                                        |
| E5  | 2A#7 | `deliveryAttempt.set(updates)` uses `Record<string, unknown>`                    |
| E6  | 2C#3 | Thundering herd on popular key expiry                                            |
| E7  | 2C#4 | Negative caching (NOT_FOUND) not implemented                                     |
| E8  | 2C#5 | Cross-platform Redis key prefix not documented                                   |
| E9  | 2C#6 | LRU eviction under high concurrency not stress-tested                            |
| E10 | 3A#2 | Proto field number gaps not documented                                           |
| E11 | 3A#3 | Unimplemented RPCs return generic error, not UNIMPLEMENTED                       |
| E12 | 3C#5 | Service startup ordering not enforced in Aspire                                  |
| E13 | 3C#6 | No readiness probe on RabbitMQ consumer                                          |
| E14 | 3C#7 | Idempotency key not propagated through retry pipeline                            |
| E15 | 6A#5 | No custom span events for retry/fallback paths                                   |

### Category F: DI / Dependencies / Test Polish (8 items)

| #   | Ref   | Finding                                                   |
| --- | ----- | --------------------------------------------------------- |
| F1  | 5A#5  | No debug logging for DI resolution                        |
| F2  | 5A#6  | `setInstance` accepts any value type (no type checking)   |
| F3  | 5B#3  | E2E test wiring diverges from production (stub providers) |
| F4  | 7B#2  | Some test packages not pinned to exact versions           |
| F5  | 7B#3  | FluentValidation version behind latest stable             |
| F6  | 7B#4  | No `dotnet outdated` in CI pipeline                       |
| F7  | 8A#2  | Some mocks don't verify call counts                       |
| F8  | 8B#14 | Test helper fixtures not shared between auth and comms    |

### Category G: Test Gaps (14 items — test backlog)

| #   | Ref   | Finding                                                     |
| --- | ----- | ----------------------------------------------------------- |
| G1  | 8A#1  | Cache-memory LRU eviction edge case not tested (0 max)      |
| G2  | 8A#3  | No negative-path test for DI circular dependency            |
| G3  | 8B#1  | No test for UPDATE/DELETE rowCount=0 → notFound             |
| G4  | 8B#2  | No test for consumer schema validation rejection            |
| G5  | 8B#3  | No test for retry tier exhaustion (max attempts)            |
| G6  | 8B#4  | No concurrent access test for channel preference updates    |
| G7  | 8B#5  | Middleware chain order not tested end-to-end                |
| G8  | 8B#6  | Hook integration tests use mocks instead of real BetterAuth |
| G9  | 8B#7  | Delivery pipeline E2E doesn't test retry path               |
| G10 | 8B#8  | No test for graceful shutdown behavior                      |
| G11 | 8B#9  | No test for Redis connection failure fallback               |
| G12 | 8B#10 | No test for email provider unavailable scenario             |
| G13 | 8B#13 | Integration test containers not reused across test files    |
| G14 | 8B#15 | No snapshot tests for gRPC proto mapping                    |

### Not categorized (reclassified)

| Ref   | Finding                                              | Reclassification                                  |
| ----- | ---------------------------------------------------- | ------------------------------------------------- |
| 8B#11 | Test helper fixtures not shared                      | Moved to F8                                       |
| 8B#12 | No property-based tests for schema validation        | Won't do — Zod schemas are declarative, not logic |
| 8B#14 | Some test descriptions don't match actual assertions | Won't do — cosmetic, no bug risk                  |
