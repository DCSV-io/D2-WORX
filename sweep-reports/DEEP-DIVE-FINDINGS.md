# Deep Dive Sweep Findings

Second sweep: cross-cutting thematic analysis across the entire codebase. 21 agents, 8 phases.

---

## Summary Table

| Severity | Count | Fixed | Reverted | Deferred |
| -------- | ----- | ----- | -------- | -------- |
| P1       | 9     | 4     | 1        | 4        |
| P2       | 36    | 2     | 0        | 34       |
| P3       | 28    | 0     | 0        | 28       |

**P1 Fixed:** Drizzle rowCount validation (6 handlers), consumer + handler schema alignment (3 files), consumer prefetchCount default, BaseHandler PII span tags.

**P1 Reverted (false positive):** RetryHelper catch filter — original `||` form was correct (De Morgan's equivalence).

**P1 Deferred (architectural):** HIBP on password reset, geoClient `undefined as never` guard, email provider unconditional resolve, Geo health monitoring.

---

## Phase 1: Auth/AuthZ Deep Audit

### Agent 1A: Auth Session Lifecycle

| #   | Sev | Finding                                           | File                              | Status   |
| --- | --- | ------------------------------------------------- | --------------------------------- | -------- |
| 1   | P1  | HIBP breach check missing on password reset       | auth hooks (architectural)        | Deferred |
| 2   | P2  | Redis secondary storage fail-open not documented  | auth-infra `secondary-storage.ts` | Open     |
| 3   | P2  | Session update hook lacks org membership re-check | auth-infra `auth-hooks.ts`        | Open     |
| 4   | P2  | `forceAllowId: true` surface area review          | auth-infra `auth-factory.ts`      | Open     |
| 5   | P2  | Emulation consent expiry not enforced on session  | auth-app emulation handlers       | Open     |
| 6   | P3  | Cookie `sameSite` default not explicitly set      | auth-infra `auth-config.ts`       | Open     |
| 7   | P3  | Session cookie name is default (fingerprintable)  | auth-infra `auth-config.ts`       | Open     |
| 8   | P3  | Sign-in event logging doesn't record failure type | auth-infra `auth-hooks.ts`        | Open     |

### Agent 1B: Auth Route Authorization

**CLEAN** — all 19 checklist items passed. IDOR prevention, CSRF, auth middleware, rate limiting, body size limits all correctly applied.

### Agent 1C: .NET Gateway JWT/AuthZ

| #   | Sev | Finding                                                | File                      | Status |
| --- | --- | ------------------------------------------------------ | ------------------------- | ------ |
| 1   | P2  | Service key comparison uses `HashSet.Contains()`       | `ServiceKeyMiddleware.cs` | Open   |
| 2   | P2  | JWKS cache no fallback when auth service unreachable   | `JwtAuthExtensions.cs`    | Open   |
| 3   | P3  | Missing `X-Content-Type-Options: nosniff` header       | REST gateway `Program.cs` | Open   |
| 4   | P3  | Health endpoint exempt from auth but not rate limiting | REST gateway endpoints    | Open   |

### Agent 1D: Cross-Platform Auth Parity

**CLEAN** — fingerprint algorithm, OrgType enum, role hierarchy, JWT claims, trust flag semantics all consistent between Node.js and .NET.

| #   | Sev | Finding                                         | File | Status |
| --- | --- | ----------------------------------------------- | ---- | ------ |
| 1   | P2  | Parity checks not documented in architecture MD | —    | Open   |

---

## Phase 2: Data Integrity and Persistence

### Agent 2A: Node.js Drizzle Schema + Repositories

| #   | Sev | Finding                                                       | File(s)                                                                                                                                                                                             | Status |
| --- | --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | P1  | UPDATE handlers don't check rowCount (silent no-op)           | auth: `update-org-contact-record.ts`, `revoke-emulation-consent-record.ts`; comms: `update-delivery-attempt-status.ts`, `update-channel-preference-record.ts`, `mark-delivery-request-processed.ts` | Fixed  |
| 2   | P1  | DELETE handler doesn't check rowCount                         | auth: `delete-org-contact-record.ts`                                                                                                                                                                | Fixed  |
| 3   | P2  | No transaction wrapping on multi-step org-contact ops         | auth-infra `create-org-contact` flow                                                                                                                                                                | Open   |
| 4   | P2  | `pg-errors.ts` only catches `23505`, not `23503`              | auth-infra `pg-errors.ts`                                                                                                                                                                           | Open   |
| 5   | P2  | Migration ordering not enforced by naming convention          | auth-infra + comms-infra migrations                                                                                                                                                                 | Open   |
| 6   | P3  | No index on `org_contact.organization_id`                     | auth-infra schema                                                                                                                                                                                   | Open   |
| 7   | P3  | `deliveryAttempt.set(updates)` uses `Record<string, unknown>` | comms-infra `update-delivery-attempt-status.ts`                                                                                                                                                     | Open   |

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

| #   | Sev | Finding                                                                                       | File(s)                               | Status |
| --- | --- | --------------------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| 1   | P2  | Consumer Zod schema was looser than handler (uuid + limits aligned)                           | `notification-consumer.ts`            | Fixed  |
| 2   | P2  | prefetchCount now configurable with default 1 (was undefined → unlimited)                     | `notification-consumer.ts`            | Fixed  |
| 3   | P2  | No DLQ for messages exhausting all retry tiers                                                | `notification-consumer.ts:122-124`    | Open   |
| 4   | P2  | Publisher confirms not explicitly enabled                                                     | comms-client + messaging `MessageBus` | Open   |
| 5   | P2  | Connection recovery backoff not configurable                                                  | messaging `MessageBus`                | Open   |

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

| #   | Sev | Finding                                                   | File(s)                         | Status |
| --- | --- | --------------------------------------------------------- | ------------------------------- | ------ |
| 1   | P2  | AbortSignal listeners missing `{ once: true }`            | Various signal handlers         | Open   |
| 2   | P2  | Graceful shutdown doesn't drain RabbitMQ consumer         | comms-api shutdown              | Open   |
| 3   | P2  | Redis connection error not surfaced to health check       | cache-redis handlers            | Open   |
| 4   | P3  | `safeStringify` recursion depth not configurable          | utilities `safe-stringify.ts`   | Open   |
| 5   | P3  | Hono error handler logs but doesn't set trace span error  | auth-api error middleware       | Open   |
| 6   | P3  | Channel resolution failure doesn't indicate which channel | comms-app `resolve-channels.ts` | Open   |
| 7   | P3  | Markdown rendering failure returns 500 not 422            | comms-app `render-html.ts`      | Open   |

### Agent 4B: .NET Error Paths

| #   | Sev | Finding                                                       | File(s)                 | Status |
| --- | --- | ------------------------------------------------------------- | ----------------------- | ------ |
| 1   | ~~P1~~ | ~~RetryHelper catch filter — false positive (De Morgan's equivalence)~~ | `RetryHelper.cs:110` | Reverted |
| 2   | P2  | CancellationToken not propagated in some middleware           | Various .NET middleware | Open   |
| 3   | P2  | `ResultExtensions` doesn't map 429 status code                | `ResultExtensions.cs`   | Open   |
| 4   | P2  | Gateway exception handler leaks exception details in dev mode | REST gateway middleware | Open   |
| 5   | P3  | RetryHelper `CalculateDelay` can overflow on high retryIndex  | `RetryHelper.cs`        | Open   |
| 6   | P3  | Batch query doesn't log which chunk failed                    | `BatchQuery.cs`         | Open   |

---

## Phase 5: DI Container and Lifecycle

### Agent 5A: DI Container Core

| #   | Sev | Finding                                                   | File(s)                     | Status |
| --- | --- | --------------------------------------------------------- | --------------------------- | ------ |
| 1   | P2  | No transitive circular dependency detection               | `@d2/di` resolve logic      | Open   |
| 2   | P2  | `ServiceCollection.build()` doesn't freeze descriptors    | `@d2/di` service-collection | Open   |
| 3   | P2  | Duplicate key registration silently overwrites            | `@d2/di` service-collection | Open   |
| 4   | P2  | Scope disposal doesn't clear `_scopedCache` references    | `@d2/di` service-scope      | Open   |
| 5   | P3  | No debug logging for DI resolution (hard to troubleshoot) | `@d2/di`                    | Open   |
| 6   | P3  | `setInstance` accepts any value type (no type checking)   | `@d2/di` service-scope      | Open   |

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

| #   | Sev | Finding                                                      | File(s)                     | Status |
| --- | --- | ------------------------------------------------------------ | --------------------------- | ------ |
| 1   | P2  | RedactionSpec not defined on all PII-handling handlers       | Various auth/comms handlers | Open   |
| 2   | P2  | Sign-in event IP address logged without redaction            | auth-infra `auth-hooks.ts`  | Open   |
| 3   | P2  | Error logs sometimes missing traceId context                 | Various error paths         | Open   |
| 4   | P3  | No structured logging standard for cross-service correlation | Logging config              | Open   |

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

## Deferred P1 Items (Architectural)

### D1: HIBP breach check on password reset

Password reset flow doesn't validate the new password against HIBP breach database. Currently only checked on sign-up. Requires BetterAuth hook extension.

### D2: geoClient `undefined as never` guard

Comms composition root casts `undefined as never` for the geoClient dependency when it's not configured. Runtime crash if a code path actually uses it. Requires deciding: fail at startup, or make optional.

### D3: Email provider unconditional resolve

Comms DI resolves email/SMS providers unconditionally. If env vars are missing, instantiation may fail at resolve time rather than gracefully degrading. Requires provider factory with lazy initialization.

### D4: Geo health monitoring

No health check or circuit breaker before gRPC calls to Geo service. If Geo is down, every request fails with unhelpful errors. Requires health check endpoint + client-side circuit breaker.
