# @d2/testing

Shared test infrastructure and custom Vitest matchers for D2Result assertions. Used by all test projects.

## Files

| File Name                                    | Description                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [result-matchers.ts](src/result-matchers.ts) | Custom Vitest matchers (`toBeSuccess`, `toBeFailure`, `toHaveData`, `toHaveErrorCode`).   |
| [test-helpers.ts](src/test-helpers.ts)       | Test utility functions (`createTraceId` for test contexts).                                |
| [index.ts](src/index.ts)                     | Side-effect import to register matchers on startup; exports `createTraceId`.              |

## Usage

```typescript
import "@d2/testing"; // registers matchers

expect(result).toBeSuccess();
expect(result).toBeFailure();
expect(result).toHaveData(expectedData);
expect(result).toHaveErrorCode("NOT_FOUND");
```

## Dependencies

- `@d2/result` — For D2Result type awareness
- `vitest >=3.0.0` — Peer dependency for matcher registration

## .NET Equivalent

`D2.Shared.Tests` (infrastructure portion) — `TestHelpers.cs` with mock `IHandlerContext`/`IRequestContext`.
