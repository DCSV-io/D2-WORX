### Module 3: Logging + Handler + Testing

**Files reviewed**: 27 files, 2595 lines of source + test code

Source files (754 lines):

- `backends/node/shared/logging/src/i-logger.ts` (24 lines)
- `backends/node/shared/logging/src/logger-options.ts` (13 lines)
- `backends/node/shared/logging/src/create-logger.ts` (38 lines)
- `backends/node/shared/logging/src/pino-logger.ts` (38 lines)
- `backends/node/shared/logging/src/service-keys.ts` (5 lines)
- `backends/node/shared/logging/src/index.ts` (5 lines)
- `backends/node/shared/handler/src/base-handler.ts` (255 lines)
- `backends/node/shared/handler/src/i-handler.ts` (13 lines)
- `backends/node/shared/handler/src/i-handler-context.ts` (11 lines)
- `backends/node/shared/handler/src/handler-context.ts` (13 lines)
- `backends/node/shared/handler/src/handler-options.ts` (25 lines)
- `backends/node/shared/handler/src/redaction-spec.ts` (14 lines)
- `backends/node/shared/handler/src/i-request-context.ts` (54 lines)
- `backends/node/shared/handler/src/validators.ts` (61 lines)
- `backends/node/shared/handler/src/service-keys.ts` (9 lines)
- `backends/node/shared/handler/src/org-type.ts` (11 lines)
- `backends/node/shared/handler/src/index.ts` (25 lines)
- `backends/node/shared/testing/src/index.ts` (4 lines)
- `backends/node/shared/testing/src/result-matchers.ts` (124 lines)
- `backends/node/shared/testing/src/test-helpers.ts` (12 lines)

Test files (1841 lines):

- `backends/node/shared/tests/src/unit/logging.test.ts` (111 lines)
- `backends/node/shared/tests/src/unit/handler.test.ts` (271 lines)
- `backends/node/shared/tests/src/unit/handler-redaction.test.ts` (648 lines)
- `backends/node/shared/tests/src/unit/validators.test.ts` (169 lines)
- `backends/node/shared/tests/src/unit/validate-input.test.ts` (92 lines)
- `backends/node/shared/tests/src/unit/d2-result.test.ts` (417 lines)
- `backends/node/shared/tests/src/unit/di/traceid-auto-injection.test.ts` (133 lines)

Documentation:

- `backends/node/shared/logging/LOGGING.md`
- `backends/node/shared/handler/HANDLER.md`
- `backends/node/shared/testing/TESTING.md`

---

**Assumptions documented**:

1. Assumes OTel SDK is initialized before any `BaseHandler` is instantiated (the lazy-init at `base-handler.ts:52` calls `trace.getTracer()` / `metrics.getMeter()` which return no-op implementations if OTel is not set up, so this is fail-safe but produces no telemetry silently).
2. Assumes `ILogger` is always available via `IHandlerContext` -- the `HandlerContext` constructor requires it, so this is enforced at construction time.
3. Assumes Pino is the only logging backend -- `createLogger()` always returns a `PinoLogger`. The `ILogger` interface enables future backends but no runtime pluggability exists.
4. Assumes `pino-pretty` is available at runtime when `pretty: true` is passed. The package is not listed in `@d2/logging` dependencies, so it will fail with a module-not-found error unless installed separately.
5. Assumes `performance.now()` is available globally (Node.js >= 16, which is guaranteed by the ES2022 target).
6. Assumes all handler inputs/outputs are JSON-serializable for debug logging (used with `JSON.stringify`).
7. Assumes `RedactionSpec.inputFields`/`outputFields` only references top-level object keys -- nested field redaction is not supported.
8. Assumes `@d2/testing` matchers are registered via side-effect import before any `expect()` calls that use them -- Vitest's `setupFiles` config must include this import.
9. Assumes `IRequestContext` boolean fields (`isOrgEmulating`, `isUserImpersonating`, etc.) are always explicitly set -- TypeScript enforces this at compile time, but `as never` casts in tests can bypass it.
10. Assumes all handler execution is async -- `executeAsync` returns `Promise<D2Result>`, no synchronous handler path exists.

---

**Findings**:

| #   | Severity | Category        | File:Line                                                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------- | --------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | High     | Bug             | `handler/src/org-type.ts:1-11`                                   | `OrgType` enum has `CustomerClient` but no `ThirdParty`. Auth domain (`auth/domain/src/enums/org-type.ts`) has `third_party` but no `customer_client`. The scope middleware (`auth/api/src/middleware/scope.ts:30`) maps `third_party` to `"ThirdParty" as OrgType`, which is an unsafe cast to a value that does not exist in the enum. Any code comparing against `OrgType` enum members will never match `"ThirdParty"`.   |
| 2   | High     | Security        | `handler/src/base-handler.ts:106,127`                            | `JSON.stringify` of handler input/output at debug level has no size limit. A handler receiving a large payload (e.g., bulk operations with thousands of items) would produce multi-megabyte log lines. No protection against circular references either -- `JSON.stringify` would throw, which gets caught by the outer `try/catch` and converts to `unhandledException`, masking the real result.                            |
| 3   | Medium   | Bug             | `logging/package.json`                                           | `pino-pretty` is used in `create-logger.ts:22` (`target: "pino-pretty"`) but not listed as a dependency (not even as `optionalDependencies` or `devDependencies`). Calling `createLogger({ pretty: true })` at runtime will fail with a module resolution error unless the consumer has `pino-pretty` installed separately.                                                                                                   |
| 4   | Medium   | Bug             | `testing/src/result-matchers.ts:98`                              | `toHaveData` uses `JSON.stringify` for deep equality comparison. This silently drops `undefined` object values, converts `NaN`/`Infinity` to `null`, loses `Date`/`Map`/`Set` semantics, and treats `{a:1, b:undefined}` as equal to `{a:1}`. Should use Vitest's built-in `equals()` utility for proper structural comparison.                                                                                               |
| 5   | Medium   | Consistency     | `handler/src/org-type.ts` vs `auth/domain/src/enums/org-type.ts` | Two different `OrgType` definitions exist: handler package uses a PascalCase string enum, auth domain uses lowercase string union. The mapping in `scope.ts` bridges them but the type systems are disconnected -- handler `OrgType` is an enum (closed set), auth domain `OrgType` is a string union (different closed set with different members).                                                                          |
| 6   | Medium   | Consistency     | `LOGGING.md:20`                                                  | Documentation shows `createLogger({ name: "my-service" })` but the actual option is `serviceName`, not `name`. The `level` example shows `"info"` as a raw string but the type requires `LogLevel` enum.                                                                                                                                                                                                                      |
| 7   | Medium   | Maintainability | `handler/src/base-handler.ts:33-35`                              | OTel `tracer`, `meter`, and `instruments` are `private static` on `BaseHandler`, meaning they are shared across ALL handler subclass instances in the entire process. This is intentional for efficiency, but means the tracer/meter names (`"d2.shared.handler"`) cannot be customized per-handler or per-service. If two services share the same process (unlikely but possible), their metrics would be indistinguishable. |
| 8   | Medium   | Security        | `handler/src/base-handler.ts:87-90`                              | Span attributes set `user.id`, `agent.org.id`, `target.org.id` directly from `IRequestContext`. These values end up in OTel traces/spans which may be exported to external observability services. If any of these IDs are considered sensitive, they would be visible in the trace backend. This is consistent with .NET behavior but worth noting as a security posture decision.                                           |
| 9   | Medium   | Performance     | `handler/src/base-handler.ts:231-239`                            | `_injectTraceId` creates a full copy of the D2Result (including spreading `messages` and `inputErrors`) every time a handler omits `traceId`. Since the auto-injection feature was added specifically so handlers DON'T need to set traceId, this copy happens on virtually every handler call. For high-throughput handlers, this allocates an extra object, two array copies, and re-freezing per invocation.               |
| 10  | Low      | Bug             | `handler/src/base-handler.ts:230`                                | `_injectTraceId` treats empty string `""` as "traceId not set" (falsy check `result.traceId`). If a handler explicitly sets `traceId: ""`, it would be overwritten with the ambient traceId. Edge case, but violates principle of least surprise.                                                                                                                                                                             |
| 11  | Low      | Consistency     | `handler-redaction.test.ts:17-37`                                | `createTestRequestContext` helper is missing required `isOrgEmulating` and `isUserImpersonating` boolean fields from `IRequestContext`. TypeScript strict mode should reject this at compile time, but `noEmit: true` in the test tsconfig means `tsc --noEmit` is not necessarily run. Runtime values will be `undefined` instead of `false`.                                                                                |
| 12  | Low      | Consistency     | `traceid-auto-injection.test.ts:66`                              | Mock logger `{ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }` is missing `fatal` and `child` methods from the `ILogger` interface. Passes at runtime only because `BaseHandler.handleAsync` never calls `fatal()` or `child()` in the normal code path.                                                                                                                                                  |
| 13  | Low      | Consistency     | multiple test files                                              | Widespread use of `"silent" as never` and `"debug" as never` instead of `LogLevel.Silent` and `LogLevel.Debug` when calling `createLogger()`. The `LogLevel` enum values are the same strings, making the `as never` cast unnecessary and reducing type safety. Appears in 20+ test files.                                                                                                                                    |
| 14  | Low      | Security        | `handler/src/validators.ts:19`                                   | `isValidEmail` regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` is extremely permissive -- it accepts `a@b.c` (single-char TLD), strings with control characters, and other technically invalid addresses. For server-side input validation, this is a weak check. The custom regex is used by `zodEmail` instead of Zod's built-in `.email()` validator which uses a more robust pattern.                                                  |
| 15  | Low      | Consistency     | `handler/src/validators.ts:22`                                   | `isValidPhoneE164` name suggests E.164 compliance, but actual E.164 format requires a `+` prefix (e.g., `+15551234567`). The function validates only raw digits without `+`, which is fine as a digits-only check but the naming is misleading.                                                                                                                                                                               |
| 16  | Low      | Maintainability | `TESTING.md`                                                     | Documentation lists only `toBeSuccess`, `toBeFailure`, `toHaveData`, `toHaveErrorCode` but implementation also provides `toHaveStatusCode`, `toHaveMessages`, and `toHaveInputErrors`.                                                                                                                                                                                                                                        |
| 17  | Low      | Elegance        | `handler/src/index.ts:9-24`                                      | Validators exported both as namespace (`export * as validators from "./validators.js"`) and as individual named exports. Doubles the public API surface without adding functionality.                                                                                                                                                                                                                                         |
| 18  | Low      | Elegance        | `testing/src/test-helpers.ts`                                    | `createTraceId()` is a single-line wrapper around `crypto.randomUUID()`. The indirection adds no value, but mirrors .NET `TestHelpers.CreateHandlerContext()` pattern.                                                                                                                                                                                                                                                        |
| 19  | Low      | Elegance        | `handler/src/base-handler.ts:148-164`                            | Completion log-level logic has 5 branches across two dimensions. Could be simplified with early return for `suppressTimeWarnings`.                                                                                                                                                                                                                                                                                            |
| 20  | Low      | Maintainability | `handler/src/base-handler.ts:82`                                 | Non-null assertion `BaseHandler.instruments!` used on lines 82, 141, 145, 188, 189. Safe because constructor always initializes, but assertions could mask bugs if initialization logic changes.                                                                                                                                                                                                                              |

---

**Tests to add**:

- [ ] Handler: `JSON.stringify` throws on circular input -- verify `handleAsync` produces `unhandledException` gracefully
- [ ] Handler: very large input logging -- test that 1MB input doesn't blow up memory
- [ ] Handler: concurrent handler instances don't interfere with shared static OTel instruments
- [ ] Handler: `warningThresholdMs`/`criticalThresholdMs` boundary (elapsed == threshold) behavior
- [ ] Handler: non-Error exception in `executeAsync` -- string/number/undefined thrown
- [ ] Validators: `zodEmail` edge cases -- `"user @domain.com"`, `a@b.c`, `user@-domain.com`
- [ ] Validators: `zodAllowedContextKey` with empty string key
- [ ] Testing matchers: `toHaveData` with `undefined` values -- `{a: 1, b: undefined}` vs `{a: 1}`
- [ ] Testing matchers: `toHaveData` with `Date` objects
- [ ] Testing matchers: `toHaveMessages` order sensitivity documentation
- [ ] Logging: `createLogger({ pretty: true })` fails without pino-pretty
- [ ] Logging: `createLogger` with `LogLevel.Silent` suppresses all output
- [ ] Handler: `_injectTraceId` with empty string traceId

**Tests to remove**:

- [ ] `handler.test.ts:241-270` (`IRequestContext helper properties`) -- Tautological: creates an object literal with specific boolean values, then asserts those same values back. Tests JavaScript object creation, not any D2-WORX logic. The `isAgentStaff`/`isAgentAdmin` properties on `IRequestContext` are plain booleans with no computed logic.
