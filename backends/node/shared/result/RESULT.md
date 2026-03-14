# @d2/result

Core result pattern for operation outcomes. Mirrors `D2.Shared.Result` in .NET. Layer 0 — no project dependencies.

## Files

| File Name                                        | Description                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [d2-result.ts](src/d2-result.ts)                 | `D2Result` class with factory methods (`ok`, `fail`, `notFound`, `unauthorized`, etc.) and helpers.            |
| [error-codes.ts](src/error-codes.ts)             | Standardized error code string constants (`NOT_FOUND`, `UNAUTHORIZED`, `RATE_LIMITED`, etc.).                  |
| [http-status-codes.ts](src/http-status-codes.ts) | HTTP status code numeric enum (200, 400, 404, 500, etc.).                                                      |
| [retry-result.ts](src/retry-result.ts)           | `retryResultAsync` — clean/dirty retry wrappers for `D2Result`-returning operations with configurable backoff. |
| [index.ts](src/index.ts)                         | Barrel re-export of all public types and functions.                                                            |

---

## Usage Examples

> **Note:** `traceId` is auto-injected by `BaseHandler` on both .NET and Node.js. Handlers do NOT pass `traceId` manually — `BaseHandler` sets it automatically. Only pass `traceId` explicitly when constructing `D2Result` outside of a handler (e.g., middleware, error mappers).

### Factory Methods — Success

```typescript
import { D2Result } from "@d2/result";

// Success (200 OK) — no data
D2Result.ok();

// Success with data (200 OK)
D2Result.ok({ data: locationDto });

// Success with messages
D2Result.ok({ data: result, messages: ["Operation completed."] });

// Created (201 Created)
D2Result.created({ data: contactDto });
```

### Factory Methods — Failure

```typescript
// Not found (404, NOT_FOUND)
D2Result.notFound<LocationDTO>();
D2Result.notFound<LocationDTO>({ messages: ["Location not found."] });

// Unauthorized (401, UNAUTHORIZED)
D2Result.unauthorized();

// Forbidden (403, FORBIDDEN)
D2Result.forbidden<OrgDTO>({ messages: ["Insufficient permissions."] });

// Validation failed (400, VALIDATION_FAILED)
D2Result.validationFailed({
  inputErrors: [
    ["email", "Email is required."],
    ["name", "Name too long."],
  ],
});

// Conflict (409, CONFLICT)
D2Result.conflict<ContactDTO>({ messages: ["Contact already exists."] });

// Service unavailable (503, SERVICE_UNAVAILABLE)
D2Result.serviceUnavailable({ messages: ["Geo service is down."] });

// Unhandled exception (500, UNHANDLED_EXCEPTION)
D2Result.unhandledException({ messages: ["Unexpected error in cache layer."] });

// Payload too large (413, PAYLOAD_TOO_LARGE)
D2Result.payloadTooLarge({ messages: ["Request body exceeds 10 MB limit."] });

// Cancelled (400, CANCELLED)
D2Result.cancelled();

// Generic failure (specify status/error manually — only when no factory matches)
D2Result.fail({
  messages: ["Upstream timeout."],
  statusCode: HttpStatusCode.InternalServerError,
  errorCode: "GATEWAY_TIMEOUT",
});
```

### Partial Success

```typescript
// Some found (206, SOME_FOUND) — failure flag but data is present
D2Result.someFound({ data: partialResults, messages: ["3 of 5 items found."] });
```

**Partial success pattern:** `NOT_FOUND` (none found) → `SOME_FOUND` (partial, data returned) → `OK` (all found).

### Error Propagation

```typescript
// BubbleFail — propagate a failure into a different result type (data discarded)
const cacheResult = await getFromCache.handleAsync({ hashId });
if (cacheResult.failed) {
  return D2Result.bubbleFail<LocationDTO>(cacheResult);
}

// Bubble — propagate any result (success or failure) with new data
const dbResult = await repository.handleAsync({ ids });
const mapped = dbResult.data?.map((e) => toDTO(e));
return D2Result.bubble<LocationDTO[]>(dbResult, mapped);
```

### Pattern Matching

```typescript
// checkSuccess — returns data if success, undefined if failure
const data = result.checkSuccess();
if (data) {
  return D2Result.ok({ data: toDTO(data) });
}

// checkFailure — returns data if failure (may have partial data), undefined if success
const partial = result.checkFailure();
if (partial && result.errorCode === "SOME_FOUND") {
  return D2Result.someFound({ data: partial });
}
return D2Result.bubbleFail(result);

// Direct property checks
if (result.success) {
  /* use result.data */
}
if (result.failed) {
  /* check result.errorCode, result.messages */
}
```

### Instance Properties

| Property      | Type                               | Description                                                            |
| ------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `success`     | `boolean`                          | Whether the operation succeeded                                        |
| `failed`      | `boolean`                          | Inverse of `success` (convenience getter)                              |
| `data`        | `TData \| undefined`               | Typed data payload (present on success, maybe partial on `SOME_FOUND`) |
| `messages`    | `readonly string[]`                | Human-readable messages (frozen array)                                 |
| `inputErrors` | `readonly InputError[]`            | Field-level validation errors: `[field, ...errors]`                    |
| `statusCode`  | `HttpStatusCode`                   | HTTP status code (200, 400, 404, 500, etc.)                            |
| `errorCode`   | `ErrorCode \| string \| undefined` | Semantic error code (e.g., `NOT_FOUND`, `CONFLICT`)                    |
| `traceId`     | `string \| undefined`              | Auto-injected by BaseHandler; explicit outside handlers                |

---

## Error Codes

| Constant                    | Description                              |
| --------------------------- | ---------------------------------------- |
| `NOT_FOUND`                 | Resource not found (404)                 |
| `SOME_FOUND`                | Partial success — some items found (206) |
| `FORBIDDEN`                 | Insufficient permissions (403)           |
| `UNAUTHORIZED`              | Not authenticated (401)                  |
| `VALIDATION_FAILED`         | Input validation errors (400)            |
| `CONFLICT`                  | Duplicate/constraint violation (409)     |
| `UNHANDLED_EXCEPTION`       | Unexpected server error (500)            |
| `SERVICE_UNAVAILABLE`       | Downstream service down (503)            |
| `RATE_LIMITED`              | Rate limit exceeded (429)                |
| `IDEMPOTENCY_IN_FLIGHT`     | Duplicate request in progress (409)      |
| `PAYLOAD_TOO_LARGE`         | Request body too large (413)             |
| `CANCELLED`                 | Operation cancelled (400)                |
| `COULD_NOT_BE_SERIALIZED`   | Serialization failure                    |
| `COULD_NOT_BE_DESERIALIZED` | Deserialization failure                  |

---

## Retry Helpers

### `retryResultAsync` (clean retrier)

For operations that already return `D2Result`:

```typescript
import { retryResultAsync } from "@d2/result";

const result = await retryResultAsync((attempt) => geoClient.findWhoIs(input), {
  maxAttempts: 3,
  baseDelayMs: 500,
  backoffMultiplier: 2,
});
```

### `retryExternalAsync` (dirty retrier)

For external operations that return raw values — caller provides mapping to `D2Result`:

```typescript
import { retryExternalAsync, D2Result } from "@d2/result";

const result = await retryExternalAsync(
  (attempt) => fetch(`https://api.example.com/data`),
  (response) =>
    response.ok ? D2Result.ok({ data: response.json() }) : D2Result.serviceUnavailable(),
  { maxAttempts: 3 },
);
```

### Retry Configuration

| Option              | Type          | Default | Description                                 |
| ------------------- | ------------- | ------- | ------------------------------------------- |
| `maxAttempts`       | `number`      | 5       | Maximum attempts (including initial call)   |
| `baseDelayMs`       | `number`      | 1000    | Base delay before first retry               |
| `backoffMultiplier` | `number`      | 2       | Multiplier applied after each retry         |
| `maxDelayMs`        | `number`      | 30000   | Maximum delay cap                           |
| `jitter`            | `boolean`     | true    | Apply full jitter (uniform [0, calculated)) |
| `signal`            | `AbortSignal` | —       | Abort signal for cancellation               |

### Transient Detection

Default transient check (used by both retriers):

- **Transient (retry)**: `SERVICE_UNAVAILABLE`, `UNHANDLED_EXCEPTION`, `RATE_LIMITED`, `CONFLICT`, any status >= 500, status 429
- **Permanent (stop)**: `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_FAILED`, `SOME_FOUND`, `PAYLOAD_TOO_LARGE`, `CANCELLED`

Override with `isTransientResult` option for custom logic.

---

## Best Practices

1. **Always use semantic factories** instead of raw `fail()`. If the outcome is "not found", use `notFound()` — not `fail({ statusCode: 404, errorCode: "NOT_FOUND" })`. The factory sets status code, error code, and default message automatically. Default messages are TK translation key strings (e.g. `"common_errors_NOT_FOUND"`) — the translation middleware resolves them to locale-appropriate text before reaching the client.

2. **Raw `fail()` is only appropriate** when no semantic factory matches (e.g., re-mapping arbitrary upstream status codes, or a code like `429` that has no dedicated factory).

3. **Do NOT pass `traceId` manually inside handlers.** `BaseHandler` auto-injects the ambient `traceId` into every `D2Result` returned from `executeAsync`. Only pass `traceId` explicitly when constructing `D2Result` **outside** of a handler (e.g., middleware error responses, global exception handlers).

4. **Use `bubbleFail` to propagate errors** across result types without losing metadata (messages, inputErrors, statusCode, errorCode, traceId). This avoids manually copying fields.

5. **Use `bubble` (not `bubbleFail`)** when you need to carry data through — for example, mapping domain entities to DTOs while preserving the original result's success/failure state and metadata.

6. **`inputErrors` format**: Each entry is `[fieldName, ...errorMessages]`. First element is the field name, remaining are error messages. Example: `["email", "Email is required.", "Must be a valid format."]`.

---

## .NET Equivalent

`D2.Shared.Result` — same factory methods (PascalCase: `Ok`, `NotFound`, `BubbleFail`), same `CheckSuccess`/`CheckFailure` pattern, same error codes and status codes. See [.NET RESULT.md](../../dotnet/shared/Result/RESULT.md).
