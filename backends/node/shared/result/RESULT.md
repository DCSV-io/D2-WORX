# @d2/result

Core result pattern for operation outcomes. Mirrors `D2.Shared.Result` in .NET. Layer 0 — no project dependencies.

## Files

| File Name                                        | Description                                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| [d2-result.ts](src/d2-result.ts)                 | `D2Result` class with factory methods (`ok`, `fail`, `notFound`, `unauthorized`, etc.) and helpers. |
| [error-codes.ts](src/error-codes.ts)             | Standardized error code string constants (`NOT_FOUND`, `UNAUTHORIZED`, `RATE_LIMITED`, etc.).       |
| [http-status-codes.ts](src/http-status-codes.ts) | HTTP status code numeric enum (200, 400, 404, 500, etc.).                                           |
| [retry-result.ts](src/retry-result.ts)           | `retryResultAsync` — clean/dirty retry wrappers for `D2Result`-returning operations with configurable backoff. |
| [index.ts](src/index.ts)                         | Barrel re-export of all public types and functions.                                                 |

## Usage

```typescript
import { D2Result } from "@d2/result";

// Success
const ok = D2Result.ok(data, { traceId });

// Failures
const fail = D2Result.fail(messages, statusCode, errorCode, { traceId });
const notFound = D2Result.notFound({ traceId });
const unauthorized = D2Result.unauthorized({ traceId });

// Checking
if (result.success) {
  /* use result.data */
}
if (!result.success) {
  /* check result.errorCode, result.messages */
}
```

## .NET Equivalent

`D2.Shared.Result` — same factory methods, same `CheckSuccess`/`CheckFailure` pattern, same error codes and status codes.
