# @d2/auth-tests

Test suite for the Auth service — covers all four packages (`@d2/auth-domain`, `@d2/auth-app`, `@d2/auth-infra`, `@d2/auth-api`). 825 tests across 61 files.

## Purpose

Validates all auth service layers: domain entity factories and rules, CQRS handler business logic, infrastructure repositories and BetterAuth configuration, and API middleware and routes. Tests are **separate** from source packages (mirrors .NET convention) — source packages have zero test dependencies.

## Design Decisions

| Decision                           | Rationale                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Dedicated test package             | Source packages stay lean — no test deps in production builds                 |
| Unit + integration split           | Unit tests mock dependencies, integration tests use Testcontainers            |
| Shared setup file                  | `src/setup.ts` registers custom D2Result matchers from `@d2/testing`          |
| Testcontainers for PG + Redis      | Real databases for integration tests — no in-memory fakes                    |
| Test helpers for containers        | `postgres-test-helpers.ts` and `redis-test-helpers.ts` manage lifecycle       |
| DI over module mocking             | Handlers accept dependencies via constructor — mock via DI, not `vi.mock`    |

## Package Structure

```
vitest.config.ts                Vitest config (merges vitest.shared.ts, project name: auth-tests)
package.json                    Test-only devDependencies
tsconfig.json                   TypeScript config
src/
  setup.ts                      Registers custom Vitest matchers
  unit/
    domain/
      enums/                    org-type, role, invitation-status tests
      exceptions/               auth-domain-error, auth-validation-error tests
      entities/                 user, organization, member, invitation, sign-in-event,
                                emulation-consent, org-contact tests
      rules/                    emulation, membership, org-creation, invitation,
                                sign-in-throttle-rules, password-rules, username-rules tests
    app/
      handlers/
        c/                      record-sign-in-event, record-sign-in-outcome,
                                create-emulation-consent, revoke-emulation-consent,
                                create-org-contact, update-org-contact,
                                delete-org-contact, create-user-contact tests
        q/                      get-sign-in-events, get-active-consents,
                                get-org-contacts, check-sign-in-throttle tests
    infra/
      access-control.test.ts
      password-hooks.test.ts
      secondary-storage.test.ts
      sign-in-throttle-store.test.ts
      username-hooks.test.ts
      mappers/                  user-mapper, org-mapper, session-mapper,
                                member-mapper, invitation-mapper tests
    api/
      middleware/               authorization, csrf, error-handler, jwt-fingerprint,
                                scope, session, session-fingerprint tests
      routes/                   auth-routes, emulation-routes, invitation-routes,
                                org-contact-routes tests
  integration/
    postgres-test-helpers.ts    Testcontainers PG setup + Drizzle migration runner
    redis-test-helpers.ts       Testcontainers Redis setup + ioredis client
    app-handlers.test.ts        App handler integration with real DB
    auth-factory.test.ts        BetterAuth instance creation + plugin verification
    better-auth-behavior.test.ts  BetterAuth API method behavior validation
    better-auth-tables.test.ts  BetterAuth table schema verification
    custom-table-repositories.test.ts  Repository handler CRUD against real PG
    migration.test.ts           Drizzle migration idempotency
    secondary-storage.test.ts   Redis secondary storage round-trip
    session-fingerprint.test.ts Session fingerprint binding + stolen token detection
    sign-in-throttle-store.test.ts  Redis throttle store operations
```

## Test Counts

| Layer       | Files | Description                                          |
| ----------- | ----- | ---------------------------------------------------- |
| Domain      | 17    | Enums, entities, rules, exceptions                   |
| App         | 12    | CQRS handlers (8 command + 4 query)                  |
| Infra       | 10    | Mappers, hooks, throttle store, secondary storage    |
| API         | 11    | Middleware (7) + routes (4)                           |
| Integration | 9     | Testcontainers (PG + Redis) + BetterAuth behavior    |
| Helpers     | 2     | Container setup helpers (not test files)              |
| **Total**   | **61**| **825 tests**                                        |

## Test Categories

### Unit Tests (52 files)

**Domain** — Pure function tests for entity factories, enum validators, business rules, and domain exceptions. No mocks needed — domain has zero infrastructure dependencies.

**App** — Handler tests with mocked repository dependencies (constructor injection, not module mocking). Validates Zod input validation, business rule enforcement, D2Result return values, and error propagation.

**Infra** — Mapper tests (BetterAuth row shape to domain type), password hook validation (domain rules + HIBP mock), secondary storage adapter (cache handler mock), throttle store (cache handler mock), and access control permission verification.

**API** — Middleware tests using Hono test utilities (mock contexts). Route tests with mocked DI scopes and BetterAuth instances.

### Integration Tests (9 files)

All integration tests use Testcontainers for real infrastructure:

| Test File                        | Infrastructure     | What It Tests                                        |
| -------------------------------- | ------------------ | ---------------------------------------------------- |
| `migration.test.ts`              | PostgreSQL         | Drizzle migrations are idempotent                    |
| `better-auth-tables.test.ts`     | PostgreSQL         | BetterAuth-managed table schemas match expectations  |
| `custom-table-repositories.test.ts` | PostgreSQL      | Full CRUD on sign_in_event, emulation_consent, org_contact |
| `auth-factory.test.ts`           | PostgreSQL + Redis | BetterAuth instance creates with all plugins         |
| `better-auth-behavior.test.ts`   | PostgreSQL + Redis | Sign-up, sign-in, session, org creation flows        |
| `secondary-storage.test.ts`      | Redis              | Set/get/delete round-trip via cache handlers          |
| `sign-in-throttle-store.test.ts` | Redis              | Known-good, lock, increment, clear operations        |
| `session-fingerprint.test.ts`    | Redis              | Fingerprint binding, mismatch detection, revocation  |
| `app-handlers.test.ts`           | PostgreSQL         | App handlers with real repository implementations    |

## Running Tests

```bash
# All auth tests
pnpm vitest run --project auth-tests

# Watch mode
pnpm vitest --project auth-tests

# Specific test file
pnpm vitest run --project auth-tests src/unit/app/handlers/c/create-org-contact.test.ts
```

## Dependencies (devDependencies only)

| Package                          | Purpose                                       |
| -------------------------------- | --------------------------------------------- |
| `@d2/auth-api`                   | API middleware + routes under test             |
| `@d2/auth-app`                   | CQRS handlers under test                      |
| `@d2/auth-domain`                | Domain types under test                        |
| `@d2/auth-infra`                 | Infra layer under test                         |
| `@d2/cache-memory`               | Memory cache for handler tests                 |
| `@d2/cache-redis`                | Redis cache for integration tests              |
| `@d2/comms-client`               | Notification handler mocking                   |
| `@d2/geo-client`                 | Geo handler mocking for contact tests          |
| `@d2/handler`                    | `HandlerContext`, `IHandlerContext` for mocks  |
| `@d2/interfaces`                 | Cache handler types for mocking                |
| `@d2/logging`                    | Logger for handler context construction        |
| `@d2/protos`                     | Proto types (ContactDTO, etc.)                 |
| `@d2/result`                     | D2Result assertions                            |
| `@d2/testing`                    | Custom Vitest matchers (`toBeSuccess`, etc.)   |
| `@d2/utilities`                  | Test data generation                           |
| `@testcontainers/postgresql`     | PostgreSQL containers for integration tests    |
| `@testcontainers/redis`          | Redis containers for integration tests         |
| `better-auth`                    | BetterAuth API in integration tests            |
| `drizzle-orm`                    | Database queries in integration tests          |
| `hono`                           | Hono test utilities for middleware/route tests  |
| `ioredis`                        | Redis client for integration tests             |
| `pg`                             | PostgreSQL client for integration tests        |
| `vitest`                         | Test runner                                    |
