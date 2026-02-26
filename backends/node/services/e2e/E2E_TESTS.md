# @d2/e2e-tests

Cross-service E2E tests validating the full Auth → Comms delivery pipeline. Each test exercises the real infrastructure stack end-to-end: sign-up triggers a Geo contact creation via gRPC, Auth publishes an event to RabbitMQ, Comms consumes the event, resolves the recipient via Geo gRPC, delivers through a stub email provider, and writes delivery records to its database.

## Purpose

Proves that the three services (Auth, Geo, Comms) integrate correctly when wired together. Tests exercise production code paths with real containers — no mocking of inter-service boundaries. The only substitution is `StubEmailProvider`, which captures emails in memory instead of dispatching to Resend/SMTP.

## Pipeline Under Test

```
Auth sign-up / action
  ├── createUserContact hook ──gRPC──► .NET Geo.API (creates contact)
  ├── BetterAuth user/action completes
  └── Publishes event ──RabbitMQ──► Comms notification consumer
                                       ├── RecipientResolver ──gRPC──► .NET Geo.API (GetContactsByIds / GetContactsByExtKeys)
                                       ├── Deliver handler → StubEmailProvider (captures email)
                                       └── Writes delivery_request + delivery_attempt rows to comms DB
```

## Infrastructure

All infrastructure starts in `beforeAll` (per test file) and tears down in `afterAll`. Containers are started in parallel.

| Component  | Image / Runtime           | Purpose                                                               |
| ---------- | ------------------------- | --------------------------------------------------------------------- |
| PostgreSQL | `postgres:18`             | Single container, 3 databases: default (Geo), `e2e_auth`, `e2e_comms` |
| Redis      | `redis:8.2`               | Distributed cache for Geo service                                     |
| RabbitMQ   | `rabbitmq:4.1-management` | Async event bus (Auth → Comms)                                        |
| Geo.API    | .NET child process        | gRPC service for contacts + WhoIs                                     |
| Auth       | In-process (`createApp`)  | BetterAuth + Hono, publishes to RabbitMQ                              |
| Comms      | In-process (DI wired)     | Notification consumer + stub email provider                           |

## Vitest Configuration

| Setting           | Value             | Reason                                                 |
| ----------------- | ----------------- | ------------------------------------------------------ |
| `testTimeout`     | 30,000 ms         | Async pipeline needs time to propagate events          |
| `hookTimeout`     | 180,000 ms        | Container startup (PG + Redis + RabbitMQ + .NET build) |
| `fileParallelism` | `false`           | Avoids .NET build lock contention between test files   |
| `globalSetup`     | `global-setup.ts` | Pre-builds Geo.API so test files use `--no-build`      |
| `setupFiles`      | `setup.ts`        | Registers `@d2/testing` custom D2Result matchers       |

Run: `pnpm vitest run --project e2e-tests`

## Test Files

### `verification-email.test.ts` (2 tests)

| Test                                                           | Validates                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Should deliver a verification email when a user signs up       | Full pipeline: sign-up → Geo contact → RabbitMQ → Comms → email captured |
| Should be idempotent — same correlationId produces same result | Duplicate event does not produce a second email (Deliver dedup)          |

### `password-reset.test.ts` (1 test)

| Test                                                                      | Validates                                                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Should deliver a password reset email when requestPasswordReset is called | Sign-up → verify → password reset request → RabbitMQ → Comms → email captured |

### `invitation-email.test.ts` (2 tests)

| Test                                                                     | Validates                                                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Should deliver invitation email to a non-existing user (contactId path)  | Creates invitation contact via Geo, resolves via `GetContactsByIds`                 |
| Should deliver invitation email to an existing user (ext-key resolution) | Existing user already has Geo contact, resolves via `GetContactsByExtKeys` (userId) |

### `geo-unavailable.test.ts` (2 tests)

| Test                                                                   | Validates                                                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Should fail sign-up when Geo service is unavailable                    | Geo down → CreateUserContact fails → BetterAuth hook aborts sign-up entirely |
| Should succeed sign-up when Geo service recovers after initial failure | Recovery scenario: Geo comes back → sign-up succeeds on retry                |

## Helpers

```
src/
  setup.ts                  Registers @d2/testing custom matchers
  global-setup.ts           Pre-builds .NET Geo.API (dotnet build, 120s timeout)
  helpers/
    containers.ts           Starts/stops Testcontainers (PG, Redis, RabbitMQ), creates per-service DBs
    geo-dotnet-service.ts   Spawns .NET Geo.API child process, converts connection URIs to .NET formats
    auth-service.ts         Wires Auth in-process via createApp(), connects RabbitMQ publisher
    comms-service.ts        Wires Comms via DI (mirrors production composition root), injects StubEmailProvider
    stub-email-provider.ts  BaseHandler-based IEmailProvider that captures emails in memory
    wait.ts                 Polling utilities: waitFor (condition), waitForRow/waitForRows (SQL)
```

### `containers.ts`

Manages the three Testcontainers. PostgreSQL hosts three databases in one container (default for Geo, `e2e_auth`, `e2e_comms`). Exposes `getAuthPgUrl()`, `getCommsPgUrl()`, `getGeoPgUrl()`, `getRedisUrl()`, `getRabbitUrl()`, plus `getAuthPool()` / `getCommsPool()` for direct DB assertions. Teardown uses per-step timeouts to prevent hanging.

### `geo-dotnet-service.ts`

Spawns Geo.API as a child process with `dotnet run --no-build`. Converts PostgreSQL URIs to ADO.NET format (`Host=...;Port=...`) and Redis URIs to StackExchange format (`host:port`). Allocates random ports for HTTP/1.1 (health) and HTTP/2 (gRPC). Polls `/health` until ready (60s timeout). Configured with `AUTO_MIGRATE=true` for test container schema setup.

### `auth-service.ts`

Creates Auth in-process via `createApp()` from `@d2/auth-api`. Connects a RabbitMQ publisher to the `NOTIFICATIONS_EXCHANGE`. Injects a no-breach HIBP cache so password validation runs domain rules but skips the external HIBP API. Returns an `AuthServiceHandle` with both the BetterAuth API (for direct calls) and the Hono app (for HTTP route testing like invitations).

### `comms-service.ts`

Mirrors the production Comms composition root via `@d2/di`. Builds a full `ServiceProvider` with: logger, scoped `IHandlerContext`, Geo client (`GetContactsByIds`), `StubEmailProvider`, and all Comms app + infra registrations. Runs Drizzle migrations, declares RabbitMQ retry topology, and starts the notification consumer with per-message DI scopes.

### `stub-email-provider.ts`

Extends `BaseHandler<SendEmailInput, SendEmailOutput>` and implements `IEmailProvider`. Captures all sent emails in an array with `to`, `subject`, `html`, `plainText`, `providerMessageId`, and `capturedAt`. Provides `getSentEmails()`, `getLastEmail()`, `sentCount()`, and `clear()`.

### `wait.ts`

Polling utilities for async assertions:

| Function      | Purpose                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `waitFor`     | Polls an async condition until true or timeout (default 15s, 200ms interval) |
| `waitForRow`  | Polls a SQL query until at least one row, returns first row                  |
| `waitForRows` | Polls a SQL query until at least N rows, returns all matching rows           |

## Dependencies

| Package                      | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `@d2/auth-api`               | Auth composition root (`createApp`)            |
| `@d2/auth-app`               | Auth handler types                             |
| `@d2/auth-infra`             | Auth config types, password functions          |
| `@d2/cache-memory`           | In-memory cache for Geo client (Comms service) |
| `@d2/cache-redis`            | Distributed cache handlers                     |
| `@d2/comms-app`              | Comms handler interfaces + DI registration     |
| `@d2/comms-client`           | `COMMS_EVENTS` exchange constants              |
| `@d2/comms-domain`           | Comms domain types                             |
| `@d2/comms-infra`            | Comms migrations, consumer, retry topology     |
| `@d2/di`                     | DI container for Comms wiring                  |
| `@d2/geo-client`             | Geo gRPC client + `GetContactsByIds`           |
| `@d2/handler`                | `BaseHandler`, `HandlerContext`                |
| `@d2/logging`                | ILogger + Pino                                 |
| `@d2/messaging`              | RabbitMQ `MessageBus` + publisher              |
| `@d2/protos`                 | Proto-generated types                          |
| `@d2/result`                 | D2Result pattern                               |
| `@d2/testing`                | Custom Vitest matchers                         |
| `@d2/utilities`              | UUIDv7 generation                              |
| `@testcontainers/postgresql` | PostgreSQL container                           |
| `@testcontainers/rabbitmq`   | RabbitMQ container                             |
| `@testcontainers/redis`      | Redis container                                |
| `drizzle-orm`                | Comms DB access + migrations                   |
| `ioredis`                    | Redis client (transitive, Comms infra)         |
| `pg`                         | PostgreSQL client + assertion pools            |
| `rabbitmq-client`            | AMQP client (transitive, messaging)            |
| `vitest`                     | Test runner                                    |
