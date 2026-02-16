# @d2/utilities

Shared utility functions and constants. Mirrors `D2.Shared.Utilities` in .NET. Layer 0 — no project dependencies.

## Files

| File Name                                        | Description                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [array-extensions.ts](src/array-extensions.ts)   | Array helper functions (`arrayTruthy`, `arrayFalsey`).                              |
| [uuid-extensions.ts](src/uuid-extensions.ts)     | UUID helper functions (`uuidTruthy`, `uuidFalsey`, `EMPTY_UUID`).                   |
| [string-extensions.ts](src/string-extensions.ts) | String cleaning/validation (`cleanStr`, email validation, phone cleaning, hashing). |
| [constants.ts](src/constants.ts)                 | Cache key prefixes and file name constants.                                         |
| [retry.ts](src/retry.ts)                         | `retryAsync()` — general-purpose retry with exponential backoff + `isTransientError` helper. |
| [index.ts](src/index.ts)                         | Barrel re-export of all utilities.                                                  |

## Key Additions

- **`generateUuidV7()`** in `uuid-extensions.ts` — UUIDv7 generation (time-sortable IDs for primary keys).
- **`retryAsync()`** in `retry.ts` — Exponential backoff (1s→2s→4s→8s), transient-only (5xx, timeout, 429), configurable via `RetryOptions`.

## .NET Equivalent

`D2.Shared.Utilities` — `Truthy()`/`Falsey()` extension methods, `CleanStr`, `EMPTY_UUID`, cache constants, `Guid.CreateVersion7()` for UUIDv7.
