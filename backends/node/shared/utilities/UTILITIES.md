# @d2/utilities

Shared utility functions and constants. Mirrors `D2.Shared.Utilities` in .NET. Layer 0 — no project dependencies.

## Files

| File Name                                        | Description                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [array-extensions.ts](src/array-extensions.ts)   | Array helper functions (`arrayTruthy`, `arrayFalsey`).                                       |
| [uuid-extensions.ts](src/uuid-extensions.ts)     | UUID helper functions (`uuidTruthy`, `uuidFalsey`, `EMPTY_UUID`).                            |
| [string-extensions.ts](src/string-extensions.ts) | String cleaning/validation (`cleanStr`, email validation, phone cleaning, hashing).          |
| [escape-html.ts](src/escape-html.ts)             | `escapeHtml()` — XSS-safe HTML entity escaping for untrusted strings.                        |
| [constants.ts](src/constants.ts)                 | Cache key prefixes and file name constants.                                                  |
| [retry.ts](src/retry.ts)                         | `retryAsync()` — general-purpose retry with exponential backoff + `isTransientError` helper. |
| [index.ts](src/index.ts)                         | Barrel re-export of all utilities.                                                           |

## Key Additions

- **`generateUuidV7()`** in `uuid-extensions.ts` — UUIDv7 generation (time-sortable IDs for primary keys).
- **`retryAsync()`** in `retry.ts` — Exponential backoff (1s→2s→4s→8s), transient-only (5xx, timeout, 429), configurable via `RetryOptions`.
- **`truthyOrUndefined()`** in `string-extensions.ts` — Boundary-safe string normalization (see below).

## `truthyOrUndefined`

```typescript
function truthyOrUndefined(value: string | null | undefined): string | undefined;
```

Converts empty/whitespace strings to `undefined` at data boundaries (user input, DB rows, proto mapping). Trims the value and returns `undefined` if the result is empty. Returns the trimmed string otherwise.

Unlike `cleanStr`, this does **NOT** collapse internal whitespace — it only trims leading/trailing whitespace and checks for emptiness. Use `cleanStr` when you need full whitespace normalization; use `truthyOrUndefined` when you want to preserve internal spacing but reject empty/blank values.

```typescript
import { truthyOrUndefined } from "@d2/utilities";

truthyOrUndefined("  hello  "); // "hello"
truthyOrUndefined("  hello world "); // "hello world" (internal space preserved)
truthyOrUndefined("   "); // undefined
truthyOrUndefined(""); // undefined
truthyOrUndefined(null); // undefined
truthyOrUndefined(undefined); // undefined
```

**C# counterpart:** `ToNullIfEmpty()` extension method in `D2.Shared.Utilities` (returns `null` instead of `undefined`).

## .NET Equivalent

`D2.Shared.Utilities` — `Truthy()`/`Falsey()` extension methods, `CleanStr`, `EMPTY_UUID`, cache constants, `Guid.CreateVersion7()` for UUIDv7.
