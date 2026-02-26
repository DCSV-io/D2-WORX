### Module 11: Shared Tests Review

**Package:** `@d2/shared-tests` (`backends/node/shared/tests/`)
**Files reviewed:** 59 test files + 2 test helpers + 4 config files + 1 TESTS.md

---

**Findings**:

| #   | Severity | Category      | File                                                | Description                                                                                                                                                                                                                                                                              |
| --- | -------- | ------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Medium   | Documentation | `TESTS.md`                                          | **8 test files not listed.** Missing: `lru.test.ts`, `contacts-evicted.test.ts`, `get-contacts-by-ids.test.ts`, `service-collection.test.ts`, `service-provider.test.ts`, `traceid-auto-injection.test.ts`, `escape-html.test.ts`, `event-contract.test.ts`. Total "744 tests" is stale. |
| 2   | Medium   | Documentation | `TESTS.md:20`                                       | `protos.test.ts` listed as "3 tests" but has ~30+ tests across 6 describe blocks.                                                                                                                                                                                                        |
| 3   | Low      | Documentation | `TESTS.md:77`                                       | States "Vitest 4.x" but `package.json` pins `vitest: "3.1.1"`.                                                                                                                                                                                                                           |
| 4   | Medium   | Coverage Gap  | `cache-redis/redis-error-paths.test.ts`             | **SetNx handler missing from error-path tests.** All other 6 Redis handlers have SERVICE_UNAVAILABLE tests.                                                                                                                                                                              |
| 5   | Medium   | Coverage Gap  | `cache-redis/`                                      | **SetNx integration test missing.** All other 6 handlers have dedicated integration files.                                                                                                                                                                                               |
| 6   | Medium   | Coverage Gap  | (missing file)                                      | **PingCache handler has zero test coverage** — neither unit nor integration. Used in aggregated health endpoint.                                                                                                                                                                         |
| 7   | Medium   | Coverage Gap  | (missing file)                                      | **PingMessageBus handler has zero test coverage.** Used in aggregated health endpoint.                                                                                                                                                                                                   |
| 8   | Low      | Coverage Gap  | `validators.test.ts`                                | **`zodAllowedContextKey` factory not tested.** Only tested indirectly through geo-client.                                                                                                                                                                                                |
| 9   | Low      | Coverage Gap  | `validators.test.ts`                                | **`zodEmail` and `zodPhoneE164` Zod schemas not directly tested.** Only boolean functions tested.                                                                                                                                                                                        |
| 10  | Low      | Coverage Gap  | `uuid-extensions.test.ts`                           | **`generateUuidV7` not tested.**                                                                                                                                                                                                                                                         |
| 11  | Low      | Coverage Gap  | (missing file)                                      | **`@d2/service-defaults` has zero test coverage.**                                                                                                                                                                                                                                       |
| 12  | Low      | Coverage Gap  | (missing file)                                      | **`@d2/service-defaults/grpc` has zero test coverage** (except `withApiKeyAuth` via comms-tests).                                                                                                                                                                                        |
| 13  | Low      | Coverage Gap  | `logging.test.ts`                                   | **Tests only verify "does not throw"** — no assertions on log structure or output content.                                                                                                                                                                                               |
| 14  | Low      | Coverage Gap  | `handler.test.ts`                                   | **No test for BaseHandler OTel span/metric creation.**                                                                                                                                                                                                                                   |
| 15  | Low      | Quality       | `interfaces/*.test.ts`                              | **Tests are compile-time type checks disguised as runtime tests.** Acceptable as contract smoke tests but should be documented as such.                                                                                                                                                  |
| 16  | Low      | Quality       | `protos.test.ts` DTO shapes                         | **DTO shape tests are compile-time type verification.** Encode/decode roundtrip tests are the genuinely valuable ones.                                                                                                                                                                   |
| 17  | Low      | Redundancy    | `ratelimit/check.test.ts:268-282`                   | **"Skip IP check when IP is localhost"** conflates IP skip with all-dimension skip due to other dimensions also being undefined.                                                                                                                                                         |
| 18  | Info     | Organization  | `protos.test.ts` vs `protos/event-contract.test.ts` | Proto tests split across two locations. Consider moving into unified `unit/protos/` subdirectory.                                                                                                                                                                                        |
| 19  | Info     | Organization  | Flat vs nested test layout                          | Some tests in subdirs, others at root level. Grouping into package-named subdirs would be more consistent.                                                                                                                                                                               |
| 20  | Info     | Organization  | Multiple files                                      | `createTestContext` duplicated in 8+ files. Extract to shared helper.                                                                                                                                                                                                                    |
| 21  | Info     | Organization  | Multiple files                                      | `createMockLogger` duplicated in multiple files.                                                                                                                                                                                                                                         |
| 22  | Info     | Consistency   | Integration tests                                   | Explicit `60_000` timeout parameters are redundant with `vitest.shared.ts` `hookTimeout: 60_000`.                                                                                                                                                                                        |

---

**Tests to add** (priority order):

| Priority | Package                | Test                                                             |
| -------- | ---------------------- | ---------------------------------------------------------------- |
| High     | `@d2/cache-redis`      | SetNx error path in `redis-error-paths.test.ts`                  |
| High     | `@d2/cache-redis`      | PingCache handler unit test (mock Redis ping success/failure)    |
| High     | `@d2/messaging`        | PingMessageBus handler unit test (connected/disconnected/throws) |
| Medium   | `@d2/utilities`        | `generateUuidV7` tests (format, uniqueness, type)                |
| Medium   | `@d2/handler`          | `zodAllowedContextKey`, `zodEmail`, `zodPhoneE164` direct tests  |
| Medium   | `@d2/cache-redis`      | SetNx integration test file                                      |
| Low      | `@d2/service-defaults` | Smoke test for `setupTelemetry` (no-op exporter)                 |
| Low      | `@d2/handler`          | OTel span/metric verification with InMemorySpanExporter          |
| Low      | `@d2/logging`          | Output structure verification (Pino destination to buffer)       |

**Tests to remove**: None — all existing tests are valid.

**Organizational improvements**:

| Priority | Improvement                                                              |
| -------- | ------------------------------------------------------------------------ |
| High     | Update TESTS.md: add 8 missing files, correct counts, fix Vitest version |
| Medium   | Extract `createTestContext`/`createMockLogger` to shared helper          |
| Low      | Group flat test files into package-named subdirectories                  |

---

**Overall assessment**: Well-structured, high-quality test suite. Strong behavioral testing, excellent error-path coverage, good integration test design with Testcontainers. Main gaps are two untested health-check handlers and outdated documentation.
