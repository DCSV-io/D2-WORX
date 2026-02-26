# Module 19: Auth Tests Review

**Package:** `@d2/auth-tests`
**Path:** `backends/node/services/auth/tests/`
**Reviewed:** 2026-02-24
**Test Files:** 61 (52 unit + 9 integration)
**Claimed Test Count:** 825+

---

## Summary

The auth test suite is the largest in the entire monorepo and demonstrates an exceptionally high standard of test quality. It covers all four DDD layers (domain, app, infra, API) with well-structured unit tests and high-value integration tests against real PostgreSQL and Redis via Testcontainers. The test organization mirrors the source structure perfectly, DI-based testing is used consistently (no module mocking), and defensive edge cases are thoroughly explored. The handful of findings below are minor refinements -- there are no structural problems or critical gaps.

---

## Findings

### Issues

| #   | Severity | Category     | File(s)                                                            | Finding                                                                                                                                                                                                                                  | Recommendation                                                                                                                                                                                       |
| --- | -------- | ------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | low      | coverage-gap | `app/src/.../q/check-health.ts`                                    | `CheckHealth` handler has no unit test. It aggregates ping results from DB/cache/messaging, has branching for healthy/degraded/not-configured, and constructs component health records. This is the only untested CQRS handler.          | Add unit test with mock PingDb/PingCache/PingMessageBus covering: all healthy, one unhealthy, messaging not configured, handler returning no data.                                                   |
| 2   | low      | coverage-gap | `api/src/routes/health.ts`                                         | `createHealthRoutes` has no unit test. It creates a DI scope, resolves CheckHealth, maps result to 200/503. Composition-level wiring that could break silently.                                                                          | Add unit test with a mock ServiceProvider returning healthy/degraded results.                                                                                                                        |
| 3   | low      | coverage-gap | `api/src/middleware/cors.ts`                                       | CORS middleware has no test. While it is a thin wrapper around Hono's `cors()`, configuration correctness (allowed headers, methods, credentials, maxAge) is not validated.                                                              | Add a small test verifying the Hono app returns correct CORS headers for the configured origin. Low priority since Hono's cors is well-tested upstream.                                              |
| 4   | low      | coverage-gap | `api/src/middleware/distributed-rate-limit.ts`                     | Distributed rate limit middleware has no test. Has branching for missing requestInfo (pass-through), blocked (429 + Retry-After header), and not-blocked (pass-through).                                                                 | Add unit test with mock Check handler covering: no requestInfo, blocked, not blocked.                                                                                                                |
| 5   | low      | coverage-gap | `api/src/middleware/request-enrichment.ts`                         | Request enrichment middleware has no test. Thin wrapper that extracts headers and calls `enrichRequest`. Tested indirectly via the `@d2/request-enrichment` shared package tests.                                                        | Acceptable as-is -- the shared package has comprehensive tests. Optional: add a smoke test verifying header extraction and `c.set()`.                                                                |
| 6   | low      | coverage-gap | `infra/src/.../hooks/id-hooks.ts`                                  | `generateId()` (UUIDv7 wrapper) has no direct unit test. It is trivially `return generateUuidV7()`. Tested indirectly in auth-factory integration tests that verify UUIDv7 format on all created entities.                               | No action needed -- indirect coverage is sufficient for a one-liner.                                                                                                                                 |
| 7   | low      | coverage-gap | `infra/src/.../hooks/org-hooks.ts`                                 | `beforeCreateOrganization()` has no direct unit test. It validates orgType and throws on invalid values. Tested indirectly in auth-factory integration tests (default "customer" is verified).                                           | Add 3 unit tests: valid orgType passes, invalid orgType throws, undefined/null orgType passes (defers to BetterAuth default).                                                                        |
| 8   | low      | coverage-gap | `infra/src/repository/utils/pg-errors.ts`                          | `isPgUniqueViolation()` has no direct unit test. Used by repo handlers to convert PG error code 23505. Tested indirectly via emulation consent integration tests (partial unique index enforcement).                                     | Add 3 unit tests: Error with code "23505" returns true, Error with code "23514" returns false, non-Error returns false.                                                                              |
| 9   | low      | coverage-gap | `domain/src/entities/session.ts`, `account.ts`                     | `Session` and `Account` interfaces have no direct tests. They are read-only interfaces with no factory functions, so there is nothing executable to test. They are exercised by integration tests (session-mapper, BetterAuth-behavior). | No action needed -- type-only contracts with no logic.                                                                                                                                               |
| 10  | low      | coverage-gap | `domain/src/value-objects/session-context.ts`                      | `SessionContext` interface has no direct test. Pure type definition. The `resolveSessionContext()` function that creates instances is thoroughly tested in `emulation.test.ts`.                                                          | No action needed.                                                                                                                                                                                    |
| 11  | low      | coverage-gap | `domain/src/constants/auth-constants.ts`                           | Constants file has no direct test. `JWT_CLAIM_TYPES` and `SESSION_FIELDS` are exercised by the integration tests that decode JWTs and read session fields. `SIGN_IN_THROTTLE` constants are used in throttle tests.                      | No action needed -- constants are validated through usage, not standalone tests.                                                                                                                     |
| 12  | info     | test-quality | `integration/auth-factory.test.ts`                                 | `signUpAndVerify()` helper uses `setTimeout(r, 100)` to wait for fire-and-forget callbacks (lines 280, 323, 333). While pragmatic, this is a timing-dependent pattern.                                                                   | Consider replacing with a polling/retry pattern or capturing the callback promise, though the risk is very low at 100ms.                                                                             |
| 13  | info     | test-quality | `unit/infra/password-hooks.test.ts`                                | Uses `global.fetch = vi.fn(...)` to mock the HIBP API. This is acceptable given the test is for an infra boundary, but it mutates global state.                                                                                          | Acceptable as-is. The test properly restores the mock in `beforeEach`. If Vitest adds `vi.unstubAllGlobals()`, consider switching.                                                                   |
| 14  | info     | redundancy   | `integration/better-auth-tables.test.ts` vs `auth-factory.test.ts` | Both files test user sign-up, session creation, organization creation, and JWKS generation. `better-auth-tables.test.ts` uses a minimal BetterAuth config; `auth-factory.test.ts` uses the full production `createAuth()`.               | Keep both -- they test at different levels. The tables test validates the Drizzle adapter works, the factory test validates the full production wiring. The overlap is intentional defense-in-depth. |
| 15  | info     | organization | Test file naming                                                   | All test files follow consistent naming conventions matching their source counterparts. The TLC folder convention (`c/`, `q/`, `r/`, `d/`) is correctly applied throughout.                                                              | No action needed -- exemplary organization.                                                                                                                                                          |
| 16  | info     | test-quality | `unit/api/routes/invitation-routes.test.ts`                        | One of the largest route test files (~35 tests) with exceptional defensive security testing: CRLF injection prevention, IDOR via session orgId, long input handling, concurrent request safety, notify event shape validation.           | Excellent. This file is a model for future route tests.                                                                                                                                              |
| 17  | low      | coverage-gap | `api/src/composition-root.ts`                                      | The composition root itself has no dedicated test. It is the most complex wiring file (~450 lines). Any DI registration error only manifests at runtime. Partially validated by E2E tests in `@d2/e2e-tests`.                            | Consider adding a composition root smoke test that calls `createApp()` with mock/test config and verifies the Hono app can serve `/health-rich`. This would catch DI wiring regressions early.       |
| 18  | low      | coverage-gap | `infra/src/registration.ts`, `app/src/registration.ts`             | DI registration functions (`addAuthInfra`, `addAuthApp`) have no direct tests. They register 15+ handlers each. A missing registration would only surface when that handler is resolved at runtime.                                      | Tested indirectly via integration tests and E2E. Optional: add a registration test that builds a ServiceProvider and resolves each key.                                                              |

### Anti-Pattern Check

| Check                    | Status | Notes                                                                                             |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| Flaky tests (timing)     | Pass   | Only 3 instances of `setTimeout(r, 100)` in integration tests, all with adequate margin.          |
| Over-mocking             | Pass   | DI-based testing used throughout. No `vi.mock()` calls except for HIBP fetch boundary. Exemplary. |
| Missing assertions       | Pass   | Every test has clear, focused assertions. No fire-and-forget test calls without expect.           |
| Test isolation           | Pass   | `beforeEach` with `cleanAllTables()` / `flushRedis()` / mock reset. No test-order dependencies.   |
| Assertion count          | Pass   | Tests have appropriate assertion density (3-8 per test, focused on the scenario).                 |
| Magic strings            | Pass   | UUID constants extracted to module-level consts. HTTP status codes use `HttpStatusCode` enum.     |
| Test helper quality      | Pass   | `createTestContext()`, `createMockXxx()` factories are clean and consistently used.               |
| Error message assertions | Pass   | Tests check error codes, status codes, and input error structure -- not fragile message text.     |

---

## Tests to Add

| Priority | Test Description                                                        | Target File (new)                                    | Rationale                                                                  |
| -------- | ----------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| medium   | CheckHealth handler unit tests (all healthy, degraded, no messaging)    | `unit/app/handlers/q/check-health.test.ts`           | Only untested CQRS handler; has non-trivial branching.                     |
| medium   | Health route unit tests (200 healthy, 503 degraded)                     | `unit/api/routes/health-routes.test.ts`              | DI scope creation + status code mapping untested.                          |
| low      | Distributed rate limit middleware tests (blocked, pass, no requestInfo) | `unit/api/middleware/distributed-rate-limit.test.ts` | Three branches with security implications.                                 |
| low      | `beforeCreateOrganization` hook unit tests (valid, invalid, null)       | `unit/infra/org-hooks.test.ts`                       | Small but has throw-on-invalid logic.                                      |
| low      | `isPgUniqueViolation` utility tests                                     | `unit/infra/pg-errors.test.ts`                       | Three-line function but used in multiple repo handlers.                    |
| low      | CORS middleware configuration verification                              | `unit/api/middleware/cors.test.ts`                   | Ensures credentials, headers, methods correctly configured. Very low risk. |

---

## Tests to Remove

| Test File | Test Name | Rationale                                                                                                                                                                        |
| --------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (none)    | (none)    | No tests identified for removal. All tests provide value, and the minor overlap between `better-auth-tables.test.ts` and `auth-factory.test.ts` is intentional defense-in-depth. |

---

## Organizational Improvements

| #   | Current State                                                                            | Suggested Improvement                                                                                                                                                                    | Impact |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Integration tests are flat in `src/integration/`                                         | Consider subdirectories: `integration/infra/` (repos, Redis stores), `integration/auth/` (BetterAuth factory, behavior), `integration/api/` (session-fingerprint)                        | low    |
| 2   | No explicit test categorization in vitest config                                         | Tests are already implicitly categorized by directory (`unit/` vs `integration/`). Consider adding `testTimeout` override for integration tests in vitest config if not already present. | low    |
| 3   | Test helpers (`postgres-test-helpers.ts`, `redis-test-helpers.ts`) are in `integration/` | These helpers are well-placed. No change needed.                                                                                                                                         | none   |

---

## Overall Assessment

**Rating: Excellent**

The `@d2/auth-tests` package is the crown jewel of the D2-WORX test suite. With 61 test files covering 825+ tests across all four DDD layers, it demonstrates:

**Strengths:**

- **Comprehensive coverage**: Every domain entity, rule, enum, exception, app handler, infra hook, mapper, API middleware, and route has dedicated tests. Integration tests cover real PostgreSQL (Drizzle migrations, repository handlers, BetterAuth full lifecycle) and real Redis (secondary storage, session fingerprint, sign-in throttle).
- **Security-first testing**: IDOR prevention (org scoping from session, not input), CSRF edge cases (subdomain attacks, null origin, scheme/port differences), session fingerprint binding (stolen token detection, fail-open on Redis failure), authorization middleware (case sensitivity, type coercion, whitespace attacks, middleware composition).
- **DI-based testing**: Zero `vi.mock()` calls for application code. All handlers receive dependencies via constructor injection, mocked with `vi.fn()`. The only global mock is `fetch` for the HIBP API boundary -- exactly what CLAUDE.md recommends.
- **Integration test quality**: The `auth-factory.test.ts` file is particularly valuable -- it tests the full `createAuth()` factory with all 6 BetterAuth plugins against real PostgreSQL, validating email verification flow, UUIDv7 generation, JWT claims (all 15+ custom claims), session hooks, password validation, and custom session fields. This single file catches more wiring issues than 50 unit tests.
- **Edge case coverage**: Empty strings, null vs undefined, numeric types where strings expected, self-emulation, concurrent requests, empty bearer tokens, multiple cookies, CRLF injection, maximum-length inputs.
- **Test organization**: Perfect mirror of source structure with TLC folder convention. Consistent helper patterns across all test files.

**Minor gaps** (all low severity):

- `CheckHealth` handler and health route lack unit tests (the only untested CQRS handler).
- Three thin API middleware wrappers (CORS, distributed rate limit, request enrichment) lack dedicated tests, though their underlying implementations are well-tested in shared packages.
- `beforeCreateOrganization` hook and `isPgUniqueViolation` utility lack direct unit tests, though both have indirect integration coverage.
- The composition root has no smoke test, relying on E2E tests for wiring validation.

These gaps are minimal for a 825+ test suite and reflect pragmatic prioritization. The suite provides high confidence in the auth service's correctness and security.
