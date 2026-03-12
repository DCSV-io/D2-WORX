# @d2/testing

Shared test infrastructure and custom Vitest matchers for D2Result assertions. Used by all Node.js test projects. Mirrors `D2.Shared.Tests` (infrastructure portion) in .NET.

## Files

| File Name                                              | Description                                                                                                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [result-matchers.ts](src/result-matchers.ts)           | Custom Vitest matchers (`toBeSuccess`, `toBeFailure`, `toHaveData`, `toHaveErrorCode`, `toHaveStatusCode`, `toHaveMessages`, `toHaveInputErrors`). |
| [test-helpers.ts](src/test-helpers.ts)                 | Test utility functions (`createTraceId` for test contexts).                                                                                        |
| [postgres-test-helper.ts](src/postgres-test-helper.ts) | `createPostgresTestHelper(runMigrations, options?)` — shared Testcontainers PG lifecycle, Drizzle setup, and table cleanup.                        |
| [index.ts](src/index.ts)                               | Side-effect import to register matchers; exports `createTraceId`, `createPostgresTestHelper`, `PostgresTestHelper`, `PostgresTestHelperOptions`.   |

---

## D2Result Matchers

Import `@d2/testing` once (side-effect import) to register all custom matchers. These mirror FluentAssertions patterns from .NET tests.

```typescript
import "@d2/testing"; // registers matchers — do this once per test file
import { D2Result, ErrorCodes, HttpStatusCode } from "@d2/result";

// Success / Failure
expect(result).toBeSuccess();
expect(result).toBeFailure();

// Status code
expect(result).toHaveStatusCode(HttpStatusCode.NotFound);
expect(result).toHaveStatusCode(HttpStatusCode.OK);

// Error code
expect(result).toHaveErrorCode(ErrorCodes.NOT_FOUND);
expect(result).toHaveErrorCode(ErrorCodes.VALIDATION_FAILED);

// Messages (exact match — order matters)
expect(result).toHaveMessages(["Resource not found."]);
expect(result).toHaveMessages(["Email is required.", "Name too long."]);

// Data (deep equality via JSON.stringify)
expect(result).toHaveData({ id: "abc", name: "Test" });
expect(result).toHaveData(expectedDto);

// Input errors (exact match — [fieldName, ...errorMessages])
expect(result).toHaveInputErrors([
  ["email", "Email is required."],
  ["name", "Name too long."],
]);
```

### Matcher Reference

| Matcher                | Assertion                                                |
| ---------------------- | -------------------------------------------------------- |
| `toBeSuccess()`        | `result.success === true`                                |
| `toBeFailure()`        | `result.success === false`                               |
| `toHaveStatusCode(n)`  | `result.statusCode === n`                                |
| `toHaveErrorCode(s)`   | `result.errorCode === s`                                 |
| `toHaveMessages(a)`    | `result.messages` deeply equals `a` (order-sensitive)    |
| `toHaveData(v)`        | `result.data` deep-equals `v` (via JSON.stringify)       |
| `toHaveInputErrors(a)` | `result.inputErrors` deeply equals `a` (order-sensitive) |

### Combining Matchers

Chain matchers in sequence for comprehensive assertions:

```typescript
expect(result).toBeFailure();
expect(result).toHaveStatusCode(HttpStatusCode.BadRequest);
expect(result).toHaveErrorCode(ErrorCodes.VALIDATION_FAILED);
expect(result).toHaveInputErrors([["phone", "Must be 7-15 digits (E.164)"]]);
```

---

## Test Helpers

### `createTraceId()`

Generates a random UUID trace ID for test handler contexts. Equivalent to .NET's `TestHelpers.CreateHandlerContext()` trace ID generation.

```typescript
import { createTraceId } from "@d2/testing";

const traceId = createTraceId(); // crypto.randomUUID()
```

### `createTestContext()` Pattern

While not provided by `@d2/testing`, the standard pattern for creating a test `HandlerContext` is:

```typescript
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";

function createTestContext(): HandlerContext {
  const requestContext: IRequestContext = {
    traceId: crypto.randomUUID(),
    isAuthenticated: false,
    isTrustedService: null,
    isOrgEmulating: false,
    isUserImpersonating: false,
  };
  const logger = createLogger({ name: "test", level: "silent" });
  return new HandlerContext(requestContext, logger);
}
```

This pattern is repeated across test projects (auth-tests, comms-tests, shared-tests). Each test suite creates its own context with the minimum fields needed for the handler under test.

---

## PostgresTestHelper

Shared lifecycle manager for integration tests that need a real PostgreSQL database. Supports two modes:

### Container Mode (default)

Starts a new Testcontainers PostgreSQL 18 instance per test suite:

```typescript
import { createPostgresTestHelper } from "@d2/testing";
import { runMigrations } from "../infra/migrations.js";

const pg = createPostgresTestHelper(runMigrations);

beforeAll(async () => {
  await pg.start(); // Starts container + runs migrations
});

afterAll(async () => {
  await pg.stop(); // Closes pool + stops container
});

afterEach(async () => {
  await pg.clean("TRUNCATE TABLE users, sessions CASCADE");
});

it("should insert a user", async () => {
  const db = pg.getDb(); // Drizzle instance
  // ... test using db
});
```

### URI Mode (globalSetup container reuse)

Connects to an existing PostgreSQL instance (for faster test suites that share a container via `globalSetup`):

```typescript
const pg = createPostgresTestHelper(runMigrations, {
  connectionUri: process.env.TEST_PG_URI, // from globalSetup
});
```

### API

| Method               | Returns          | Description                                          |
| -------------------- | ---------------- | ---------------------------------------------------- |
| `start()`            | `Promise<void>`  | Start container (or connect to URI) + run migrations |
| `stop()`             | `Promise<void>`  | Close pool + stop container (if we own it)           |
| `getPool()`          | `pg.Pool`        | Underlying pg.Pool for raw queries                   |
| `getDb()`            | `NodePgDatabase` | Drizzle database instance                            |
| `getConnectionUri()` | `string`         | Connection URI (for passing to other services)       |
| `clean(sql)`         | `Promise<void>`  | Execute raw SQL (e.g., `TRUNCATE TABLE ... CASCADE`) |

---

## Dependencies

### Required

- `@d2/result` — For D2Result type awareness in matchers
- `vitest >=3.0.0` — Peer dependency for matcher registration

### Optional (for `createPostgresTestHelper`)

- `@testcontainers/postgresql` — PostgreSQL container lifecycle
- `pg` — PostgreSQL client
- `drizzle-orm` — Drizzle ORM for database access

---

## Test Project Architecture

Test projects are **separate** from source packages (mirrors .NET). Source packages have zero test dependencies — all test deps live in dedicated test projects.

| Package               | Purpose                                  | .NET Equivalent           |
| --------------------- | ---------------------------------------- | ------------------------- |
| `@d2/testing`         | Shared test infra (matchers, containers) | `D2.Shared.Tests` (infra) |
| `@d2/shared-tests`    | Tests for all shared packages            | `D2.Shared.Tests` (tests) |
| `@d2/auth-tests`      | Tests for Auth service                   | `Geo.Tests` (pattern)     |
| `@d2/comms-tests`     | Tests for Comms service                  | `Geo.Tests` (pattern)     |
| `@d2/e2e-tests`       | Cross-service E2E tests                  | —                         |
| `@d2/auth-bff-client` | Co-located tests (`src/__tests__/`)      | —                         |
| `d2-sveltekit`        | SvelteKit unit + Playwright E2E tests    | —                         |

### Vitest Monorepo Setup

- Root `vitest.workspace.ts` with explicit project paths + `vitest.config.ts` for coverage
- Shared `vitest.shared.ts` at `backends/node/` inherited by all test projects
- Run from repo root: `pnpm vitest` (all) or `pnpm vitest --project shared-tests` (specific)
- Coverage aggregated across all packages via `@vitest/coverage-v8`

### Design Principles

- **Prefer dependency injection over module mocking** — design services to accept deps via constructor/factory (mirrors .NET handler pattern with `IHandlerContext`). Use `vi.mock` only for infrastructure boundaries
- **Integration tests hit real databases** — Testcontainers (PostgreSQL 18, Redis) for integration tests. No mocking DB/cache in integration tests
- **Test case coverage, not just line coverage** — see [TESTS.md](../../dotnet/shared/Tests/TESTS.md) for the full case coverage checklist (8 categories: happy path, garbage input, boundary values, format violations, cross-field deps, error propagation, idempotency, concurrency)

---

## .NET Equivalent

`D2.Shared.Tests` — `TestHelpers.cs` with mock `IHandlerContext`/`IRequestContext`, xUnit + FluentAssertions + Moq + Testcontainers. See [.NET TESTS.md](../../dotnet/shared/Tests/TESTS.md).
