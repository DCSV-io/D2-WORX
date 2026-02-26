### Module 1: Result + Utilities

**Files reviewed**:

| File                      | Path                                                                | Lines |
| ------------------------- | ------------------------------------------------------------------- | ----- |
| d2-result.ts              | `backends/node/shared/result/src/d2-result.ts`                      | 251   |
| http-status-codes.ts      | `backends/node/shared/result/src/http-status-codes.ts`              | 19    |
| error-codes.ts            | `backends/node/shared/result/src/error-codes.ts`                    | 20    |
| index.ts (result)         | `backends/node/shared/result/src/index.ts`                          | 11    |
| retry-result.ts           | `backends/node/shared/result/src/retry-result.ts`                   | 246   |
| package.json (result)     | `backends/node/shared/result/package.json`                          | 19    |
| RESULT.md                 | `backends/node/shared/result/RESULT.md`                             | 40    |
| tsconfig.json (result)    | `backends/node/shared/result/tsconfig.json`                         | 8     |
| array-extensions.ts       | `backends/node/shared/utilities/src/array-extensions.ts`            | 22    |
| constants.ts              | `backends/node/shared/utilities/src/constants.ts`                   | 17    |
| string-extensions.ts      | `backends/node/shared/utilities/src/string-extensions.ts`           | 71    |
| retry.ts                  | `backends/node/shared/utilities/src/retry.ts`                       | 175   |
| uuid-extensions.ts        | `backends/node/shared/utilities/src/uuid-extensions.ts`             | 32    |
| escape-html.ts            | `backends/node/shared/utilities/src/escape-html.ts`                 | 14    |
| index.ts (utilities)      | `backends/node/shared/utilities/src/index.ts`                       | 16    |
| package.json (utilities)  | `backends/node/shared/utilities/package.json`                       | 22    |
| UTILITIES.md              | `backends/node/shared/utilities/UTILITIES.md`                       | 24    |
| tsconfig.json (utilities) | `backends/node/shared/utilities/tsconfig.json`                      | 8     |
| d2-result.test.ts         | `backends/node/shared/tests/src/unit/d2-result.test.ts`             | 418   |
| array-extensions.test.ts  | `backends/node/shared/tests/src/unit/array-extensions.test.ts`      | 58    |
| constants.test.ts         | `backends/node/shared/tests/src/unit/constants.test.ts`             | 23    |
| string-extensions.test.ts | `backends/node/shared/tests/src/unit/string-extensions.test.ts`     | 149   |
| uuid-extensions.test.ts   | `backends/node/shared/tests/src/unit/uuid-extensions.test.ts`       | 75    |
| retry-result.test.ts      | `backends/node/shared/tests/src/unit/retry-result.test.ts`          | 583   |
| retry.test.ts             | `backends/node/shared/tests/src/unit/retry.test.ts`                 | 392   |
| escape-html.test.ts       | `backends/node/shared/tests/src/unit/utilities/escape-html.test.ts` | 29    |

**Total**: 18 source files (996 lines), 8 test files (2127 lines)

---

**Assumptions documented**:

1. `D2ResultStatus` values in `ErrorCodes` are exhaustive -- the `isTransientResult` switch has a `default: break` fallthrough that relies on status code, meaning any future error codes not added to the switch will get status-code-based classification instead of explicit routing.
2. UUID format validation (RFC 4122 structure) is not performed by `uuidTruthy`/`uuidFalsey` -- they only check for null/empty/all-zeros. Any non-empty string that is not `EMPTY_UUID` passes `uuidTruthy`, including malformed UUIDs like `"abc"`.
3. Email validation in `cleanAndValidateEmail` is intentionally permissive (basic structural check only) -- real RFC 5322 compliance is not attempted. The function assumes callers accept the risk of passing syntactically unusual but structurally valid addresses.
4. Phone number validation in `cleanAndValidatePhoneNumber` strips all non-digits and validates length (7-15) -- it assumes the caller knows the country code is required and does not validate the number against any country-specific rules.
5. `escapeHtml` assumes the input string is never null/undefined -- it will throw a TypeError on nullish input since it calls `.replace()` directly.
6. `arrayTruthy`/`arrayFalsey` accept `T[] | null | undefined` only -- they do not accept `readonly T[]`, `Set<T>`, or other iterables. Callers with readonly arrays must cast.
7. The retry utilities (`retryAsync`, `retryResultAsync`, `retryExternalAsync`) assume `maxAttempts >= 1`. Passing `0` or negative values causes the for-loop to never execute, leading to returning the initial `lastResult` (an `unhandledException` D2Result) or `undefined as T`.
8. The `defaultDelay` functions assume the `AbortSignal` will either abort or be garbage collected -- the abort listener is not removed when the timer fires normally, relying on `{ once: true }` and eventual GC for cleanup.
9. `getNormalizedStrForHashing` produces pipe-delimited strings that are intended to be hashed downstream -- it assumes the caller will apply the actual hashing algorithm (SHA-256). An empty parts array produces `""`, which would produce a valid but possibly unexpected hash.
10. `D2Result.bubbleFail` always sets `success: false` regardless of whether `source` was successful -- it does not validate that the source is actually a failure result.

---

**Findings**:

| #   | Severity | Category        | File:Line                                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------- | --------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Medium   | Bug             | `retry-result.ts:233-244`, `retry.ts:162-174` | **Memory leak in `defaultDelay`**: When the timer fires normally (no abort), the abort event listener remains registered on the `AbortSignal`. Since `{ once: true }` only means "fire at most once" (not "auto-remove after timeout"), these listeners accumulate across retries. For a 5-attempt retry with a long-lived request-scoped signal, 4 stale listeners remain. Fix: in the `setTimeout` callback, use `signal.removeEventListener("abort", handler)` before resolving, or use `AbortSignal.timeout()` with proper cleanup. |
| 2   | Medium   | Bug             | `retry.ts:130-133`                            | **Dead/redundant code after catch block**: The condition `if (!checkTransient(error) \|\| attempt >= maxAttempts)` at line 130 is always true when reached, because lines 122-128 already handled the only case where both `checkTransient(error)` is true AND `attempt < maxAttempts`. The `if` guard is logically unnecessary and the code after the for-loop (lines 137-140) is dead code for the error path -- it can only be reached via the `shouldRetry` path.                                                                   |
| 3   | Medium   | Bug             | `retry.ts:140`                                | **Unsafe type assertion `lastResult as T`**: If `maxAttempts` is 0 or negative, the for-loop never executes, `lastWasError` stays `false`, and `lastResult` (which is `undefined`) is returned as `T`. There is no guard against `maxAttempts <= 0`, and `retryResultAsync` has the same issue (returns the initial `D2Result.unhandledException()` without executing the operation).                                                                                                                                                   |
| 4   | Low      | Bug             | `retry-result.ts:170-183`                     | **`mapResult` exceptions conflated with `operation` exceptions**: When `mapResult(raw)` throws inside the try block, the catch block applies `mapError` to the mapper's error, not the operation's. This is tested and documented (test line 563), but it means the caller's `mapError` function may receive errors it doesn't expect (e.g., a TypeError from a bad mapper, not a network error from the operation). A separate try/catch around `mapResult` would give clearer semantics.                                              |
| 5   | Low      | Security        | `escape-html.ts:7`                            | **No null guard on `escapeHtml`**: Calling `escapeHtml(null as any)` or `escapeHtml(undefined as any)` throws `TypeError`. While TypeScript types prevent this at compile time, runtime callers from untyped boundaries could hit this. A `str ?? ""` guard would be defensive.                                                                                                                                                                                                                                                         |
| 6   | Low      | Consistency     | `RESULT.md:21-25`                             | **Incorrect API usage examples in RESULT.md**: The examples show `D2Result.ok(data, { traceId })` and `D2Result.fail(messages, statusCode, errorCode, { traceId })` as if they take positional parameters. The actual API uses a single options object: `D2Result.ok({ data, traceId })` and `D2Result.fail({ messages, statusCode, errorCode, traceId })`.                                                                                                                                                                             |
| 7   | Low      | Consistency     | `UTILITIES.md`                                | **`escapeHtml` and `retry.ts` missing from UTILITIES.md Files table**: The documentation lists 5 files but the package contains 7 source files. `escape-html.ts` and its description are absent. Also, `retry.ts` entry doesn't mention `isTransientError`.                                                                                                                                                                                                                                                                             |
| 8   | Low      | Consistency     | `d2-result.test.ts:356-371`                   | **ErrorCodes completeness test missing `IDEMPOTENCY_IN_FLIGHT`**: The `it.each` array lists 11 of 12 error codes, omitting `IDEMPOTENCY_IN_FLIGHT`.                                                                                                                                                                                                                                                                                                                                                                                     |
| 9   | Low      | Consistency     | `retry-result.ts:49-77`                       | **`isTransientResult` does not explicitly handle `IDEMPOTENCY_IN_FLIGHT`**: Falls through to `default: break` and status-code check. Since idempotency-in-flight typically uses 409 Conflict, it correctly returns `false` (not transient). But unlike `CONFLICT` itself (classified as transient), this asymmetry is implicit rather than explicit.                                                                                                                                                                                    |
| 10  | Low      | Maintainability | `retry-result.ts:4-26`, `retry.ts:1-23`       | **Duplicated RetryConfig and helper functions between `@d2/result` and `@d2/utilities`**: `resolveConfig`, `calculateDelay`, and `defaultDelay` are identical in both packages. Intentional (zero deps for `@d2/result`) but creates maintenance burden -- any bugfix must be applied in both places.                                                                                                                                                                                                                                   |
| 11  | Low      | Maintainability | `array-extensions.ts:12`                      | **`arrayTruthy` type guard narrows to `T[] & { length: number }` which is identical to `T[]`**: The intersection adds no information. A more useful narrowing would be `arr is [T, ...T[]]` (non-empty tuple type).                                                                                                                                                                                                                                                                                                                     |
| 12  | Low      | Elegance        | `d2-result.ts:227-233`                        | **`bubbleFail` creates mutable copies of frozen arrays unnecessarily**: `[...source.messages]` creates a new array from frozen source, then the constructor `Object.freeze()`s it again. Double-freeze is redundant work.                                                                                                                                                                                                                                                                                                               |
| 13  | Low      | Elegance        | `d2-result.ts:228`                            | **`inputErrors` deep copy uses `map((ie) => [...ie])`**: Shallow spread is sufficient since inner strings are immutable primitives. The copy-then-freeze pattern is consistent but adds allocation overhead on every bubble operation.                                                                                                                                                                                                                                                                                                  |
| 14  | Low      | Performance     | `escape-html.ts:8-13`                         | **Five chained `.replace()` calls with regex**: Each call traverses the full string. For very large strings, a single-pass approach using `.replace(/[&<>"']/g, char => entities[char])` with a lookup table would be ~5x fewer traversals. For typical short strings, negligible.                                                                                                                                                                                                                                                      |
| 15  | Low      | Maintainability | `string-extensions.ts:7`                      | **Email regex `EMAIL_RE` is very permissive**: Accepts `a@b.c` (single-char TLD). While documented as "basic structure" validation, callers might expect stronger validation given the function name includes "Validate." Worth confirming .NET parity.                                                                                                                                                                                                                                                                                 |

---

**Tests to add**:

- [ ] `generateUuidV7` -- no tests exist. Should test: returns string, matches UUID v7 format, two calls produce different values, 36 chars with hyphens.
- [ ] `GEO_REF_DATA_FILE_NAME` -- not tested in `constants.test.ts`. Should verify value is `"georefdata.bin"`.
- [ ] `ErrorCodes` test: add `IDEMPOTENCY_IN_FLIGHT` to the `it.each` array (finding #8).
- [ ] `isTransientResult` with `IDEMPOTENCY_IN_FLIGHT` error code -- explicitly test it returns `false`.
- [ ] `retryResultAsync` / `retryExternalAsync` / `retryAsync` with `maxAttempts: 0` -- document expected behavior.
- [ ] `escapeHtml` with backticks, forward slashes, and null bytes -- document boundary behavior.
- [ ] `escapeHtml` with already-escaped input (double escaping) -- `&amp;` should become `&amp;amp;`.
- [ ] `uuidTruthy` with malformed strings like `"not-a-uuid"` -- document that it only checks for empty/EMPTY_UUID.
- [ ] `cleanAndValidatePhoneNumber` with a leading `+` character -- `"+1234567"` strips the `+` to `"1234567"`.
- [ ] `D2Result.bubbleFail` called on a success result -- should verify it still produces `success: false`.

**Tests to remove**:

- [ ] `uuidTruthy` test "returns false for EMPTY_UUID constant" (line 35-37 of `uuid-extensions.test.ts`) is near-duplicate of "returns false for the all-zeros UUID" (line 31-33) -- both test the exact same string value. Keep one. Severity: negligible.
