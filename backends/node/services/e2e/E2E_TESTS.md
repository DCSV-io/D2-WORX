# @d2/e2e-tests

Cross-service E2E tests validating the full Auth → Comms delivery pipeline, Dkron job execution chain, and BFF auth client integration. Two test tiers: **Vitest API-level** tests call services directly (in-process), and **Playwright browser** tests drive real browsers against the full stack (SvelteKit + Auth + Geo + Comms). Auth pipeline tests exercise sign-up → Geo contact creation → RabbitMQ → Comms → email delivery. Dkron tests exercise job registration, reconciliation, and the full-chain Dkron → REST Gateway → gRPC → service → database cleanup. BFF client tests exercise SessionResolver, AuthProxy, and JwtManager over real HTTP against the Auth service.

## Purpose

Proves that the three services (Auth, Geo, Comms) integrate correctly when wired together. Tests exercise production code paths with real containers — no mocking of inter-service boundaries. The only substitution is `StubEmailProvider`, which captures emails in memory instead of dispatching to Resend/SMTP.

The project contains two complementary test tiers:

| Tier                 | Runner          | Scope                                                       | Run Command                                         |
| -------------------- | --------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| API-level (Vitest)   | Vitest          | In-process service calls, DB assertions, message bus events | `pnpm vitest run --project e2e-tests`               |
| Browser (Playwright) | Playwright Test | Real browser → SvelteKit → all backend services             | `npx playwright test --config playwright.config.ts` |

## Vitest API-Level Tests

### Pipeline Under Test

```
Auth sign-up / action
  ├── createUserContact hook ──gRPC──► .NET Geo.API (creates contact)
  ├── BetterAuth user/action completes
  └── Publishes event ──RabbitMQ──► Comms notification consumer
                                       ├── RecipientResolver ──gRPC──► .NET Geo.API (GetContactsByIds / GetContactsByExtKeys)
                                       ├── Deliver handler → StubEmailProvider (captures email)
                                       └── Writes delivery_request + delivery_attempt rows to comms DB
```

### Infrastructure

All infrastructure starts in `beforeAll` (per test file) and tears down in `afterAll`. Containers are started in parallel.

| Component  | Image / Runtime           | Purpose                                                               |
| ---------- | ------------------------- | --------------------------------------------------------------------- |
| PostgreSQL | `postgres:18`             | Single container, 3 databases: default (Geo), `e2e_auth`, `e2e_comms` |
| Redis      | `redis:8.2`               | Distributed cache for Geo service                                     |
| RabbitMQ   | `rabbitmq:4.1-management` | Async event bus (Auth → Comms)                                        |
| Geo.API    | .NET child process        | gRPC service for contacts + WhoIs                                     |
| Gateway    | .NET child process        | REST → gRPC routing gateway (for Dkron job chain tests)               |
| Dkron      | `dkron/dkron:4.0.9`       | Distributed job scheduler (GenericContainer, for job chain tests)     |
| Auth       | In-process (`createApp`)  | BetterAuth + Hono, publishes to RabbitMQ                              |
| Comms      | In-process (DI wired)     | Notification consumer + stub email provider                           |

### Vitest Configuration

| Setting           | Value             | Reason                                                           |
| ----------------- | ----------------- | ---------------------------------------------------------------- |
| `testTimeout`     | 30,000 ms         | Async pipeline needs time to propagate events                    |
| `hookTimeout`     | 180,000 ms        | Container startup (PG + Redis + RabbitMQ + .NET build)           |
| `fileParallelism` | `false`           | Avoids .NET build lock contention between test files             |
| `globalSetup`     | `global-setup.ts` | Pre-builds Geo.API + REST Gateway so test files use `--no-build` |
| `setupFiles`      | `setup.ts`        | Registers `@d2/testing` custom D2Result matchers                 |

Run: `pnpm vitest run --project e2e-tests`

### Test Files

#### `verification-email.test.ts` (2 tests)

| Test                                                           | Validates                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Should deliver a verification email when a user signs up       | Full pipeline: sign-up → Geo contact → RabbitMQ → Comms → email captured |
| Should be idempotent — same correlationId produces same result | Duplicate event does not produce a second email (Deliver dedup)          |

#### `password-reset.test.ts` (1 test)

| Test                                                                      | Validates                                                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Should deliver a password reset email when requestPasswordReset is called | Sign-up → verify → password reset request → RabbitMQ → Comms → email captured |

#### `invitation-email.test.ts` (2 tests)

| Test                                                                     | Validates                                                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Should deliver invitation email to a non-existing user (contactId path)  | Creates invitation contact via Geo, resolves via `GetContactsByIds`                 |
| Should deliver invitation email to an existing user (ext-key resolution) | Existing user already has Geo contact, resolves via `GetContactsByExtKeys` (userId) |

#### `job-execution.test.ts` (4 tests)

| Test                                                                       | Validates                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Should register all 8 jobs on initial reconciliation                       | dkron-mgr reconciler creates all jobs in a fresh Dkron container               |
| Should report all unchanged on second reconciliation                       | Idempotent — re-running reconciliation produces no changes                     |
| Should detect and correct schedule drift                                   | Tampered job schedule is restored to the declared definition                   |
| Should delete orphaned managed jobs while leaving unmanaged jobs untouched | Orphan cleanup removes stale managed jobs, ignores manually-created Dkron jobs |

#### `dkron-job-chain.test.ts` (1 test)

| Test                                                                      | Validates                                                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Should execute a Dkron job through the full chain (Dkron → Gateway → Geo) | Dkron fires HTTP → Gateway (service key auth) → gRPC (API key) → Geo handler → DB cleanup |

#### `bff-client.test.ts` (10 tests)

| Test                                                                       | Validates                                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Should resolve session and user from a valid session cookie                | SessionResolver returns session+user from signed cookie over HTTP    |
| Should return null session for an invalid cookie                           | SessionResolver handles invalid/expired cookies gracefully           |
| Should return null without making a network call when no cookie is present | SessionResolver short-circuits when no session cookie exists         |
| Should proxy GET /api/auth/get-session with valid cookie and return 200    | AuthProxy forwards GET requests with cookies preserved               |
| Should proxy POST /api/auth/sign-in/email and return 200                   | AuthProxy forwards POST requests with body and returns auth response |
| Should proxy sign-in response with set-cookie headers preserved            | AuthProxy preserves set-cookie headers from Auth service responses   |
| Should produce the same session data as a direct BetterAuth API call       | SessionResolver HTTP path returns identical data to in-process API   |
| Should obtain a valid RS256 JWT from the auth service                      | JwtManager fetches and returns a valid RS256 JWT token               |
| Should return cached token on second call                                  | JwtManager caches JWT and returns same token on subsequent calls     |
| Should re-fetch after invalidate()                                         | JwtManager.invalidate() clears cache, next call fetches fresh token  |

#### `geo-unavailable.test.ts` (2 tests)

| Test                                                                   | Validates                                                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Should fail sign-up when Geo service is unavailable                    | Geo down → CreateUserContact fails → BetterAuth hook aborts sign-up entirely |
| Should succeed sign-up when Geo service recovers after initial failure | Recovery scenario: Geo comes back → sign-up succeeds on retry                |

### Helpers

```
src/
  setup.ts                  Registers @d2/testing custom matchers
  global-setup.ts           Pre-builds .NET Geo.API + REST Gateway (dotnet build, 120s timeout each)
  helpers/
    containers.ts           Starts/stops Testcontainers (PG, Redis, RabbitMQ), creates per-service DBs
    geo-dotnet-service.ts   Spawns .NET Geo.API child process, converts connection URIs to .NET formats
    gateway-service.ts      Spawns .NET REST Gateway child process, configures service key + gRPC API key auth
    auth-service.ts         Wires Auth in-process via createApp(), connects RabbitMQ publisher
    auth-http-server.ts     Wraps Hono app in @hono/node-server on ephemeral port (browser tests)
    comms-service.ts        Wires Comms via DI (mirrors production composition root), injects StubEmailProvider
    sveltekit-server.ts     Starts/stops SvelteKit dev server as child process (browser tests)
    stub-email-provider.ts  BaseHandler-based IEmailProvider that captures emails in memory
    wait.ts                 Polling utilities: waitFor (condition), waitForRow/waitForRows (SQL)
```

#### `containers.ts`

Manages the three Testcontainers. PostgreSQL hosts three databases in one container (default for Geo, `e2e_auth`, `e2e_comms`). Exposes `getAuthPgUrl()`, `getCommsPgUrl()`, `getGeoPgUrl()`, `getRedisUrl()`, `getRabbitUrl()`, plus `getAuthPool()` / `getCommsPool()` for direct DB assertions. Teardown uses per-step timeouts to prevent hanging.

#### `geo-dotnet-service.ts`

Spawns Geo.API as a child process with `dotnet run --no-build`. Converts PostgreSQL URIs to ADO.NET format (`Host=...;Port=...`) and Redis URIs to StackExchange format (`host:port`). Allocates random ports for HTTP/1.1 (health) and HTTP/2 (gRPC). Polls `/health` until ready (60s timeout). Configured with `AUTO_MIGRATE=true` for test container schema setup.

#### `gateway-service.ts`

Spawns the .NET REST Gateway as a child process with `dotnet run --no-build`. Configures service key auth (`GATEWAY_SERVICEKEY__ValidKeys__0`), Geo gRPC API key (`GATEWAY_GEO_GRPC_API_KEY`), Redis connection, and Geo service address. Allocates a random HTTP port, polls `/health` until ready. Used by `dkron-job-chain.test.ts` to test the full Dkron → Gateway → Geo pipeline.

#### `auth-service.ts`

Creates Auth in-process via `createApp()` from `@d2/auth-api`. Connects a RabbitMQ publisher to the `NOTIFICATIONS_EXCHANGE`. Injects a no-breach HIBP cache so password validation runs domain rules but skips the external HIBP API. Returns an `AuthServiceHandle` with both the BetterAuth API (for direct calls) and the Hono app (for HTTP route testing like invitations).

#### `comms-service.ts`

Mirrors the production Comms composition root via `@d2/di`. Builds a full `ServiceProvider` with: logger, scoped `IHandlerContext`, Geo client (`GetContactsByIds`), `StubEmailProvider`, and all Comms app + infra registrations. Runs Drizzle migrations, declares RabbitMQ retry topology, and starts the notification consumer with per-message DI scopes.

#### `stub-email-provider.ts`

Extends `BaseHandler<SendEmailInput, SendEmailOutput>` and implements `IEmailProvider`. Captures all sent emails in an array with `to`, `subject`, `html`, `plainText`, `providerMessageId`, and `capturedAt`. Provides `getSentEmails()`, `getLastEmail()`, `sentCount()`, and `clear()`.

#### `wait.ts`

Polling utilities for async assertions:

| Function      | Purpose                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `waitFor`     | Polls an async condition until true or timeout (default 15s, 200ms interval) |
| `waitForRow`  | Polls a SQL query until at least one row, returns first row                  |
| `waitForRows` | Polls a SQL query until at least N rows, returns all matching rows           |

## Dependencies

| Package                      | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `@d2/auth-api`               | Auth composition root (`createApp`)               |
| `@d2/auth-app`               | Auth handler types                                |
| `@d2/auth-bff-client`        | SvelteKit BFF auth client (route guards, session) |
| `@d2/auth-infra`             | Auth config types, password functions             |
| `@d2/cache-memory`           | In-memory cache for Geo client (Comms service)    |
| `@d2/cache-redis`            | Distributed cache handlers                        |
| `@d2/comms-app`              | Comms handler interfaces + DI registration        |
| `@d2/comms-client`           | `COMMS_EVENTS` exchange constants                 |
| `@d2/comms-domain`           | Comms domain types                                |
| `@d2/comms-infra`            | Comms migrations, consumer, retry topology        |
| `@d2/di`                     | DI container for Comms wiring                     |
| `@d2/geo-client`             | Geo gRPC client + `GetContactsByIds`              |
| `@d2/handler`                | `BaseHandler`, `HandlerContext`                   |
| `@d2/logging`                | ILogger + Pino                                    |
| `@d2/messaging`              | RabbitMQ `MessageBus` + publisher                 |
| `@d2/protos`                 | Proto-generated types                             |
| `@d2/result`                 | D2Result pattern                                  |
| `@d2/testing`                | Custom Vitest matchers                            |
| `@d2/utilities`              | UUIDv7 generation                                 |
| `@d2/dkron-mgr`              | Dkron job definitions + reconciler                |
| `@hono/node-server`          | HTTP server wrapper for Hono (browser E2E Auth)   |
| `@playwright/test`           | Browser E2E test runner                           |
| `testcontainers`             | GenericContainer for Dkron                        |
| `@testcontainers/postgresql` | PostgreSQL container                              |
| `@testcontainers/rabbitmq`   | RabbitMQ container                                |
| `@testcontainers/redis`      | Redis container                                   |
| `drizzle-orm`                | Comms DB access + migrations                      |
| `hono`                       | HTTP framework (Auth service, browser E2E)        |
| `ioredis`                    | Redis client (transitive, Comms infra)            |
| `pg`                         | PostgreSQL client + assertion pools               |
| `rabbitmq-client`            | AMQP client (transitive, messaging)               |
| `vitest`                     | API-level test runner                             |

## Stub vs Production Divergence

E2E tests use stub providers for email and SMS delivery. All other infrastructure runs real containers matching production images. This section documents where stubs differ from production behavior.

| Component     | Production              | E2E Stub                                 | Divergence                                          |
| ------------- | ----------------------- | ---------------------------------------- | --------------------------------------------------- |
| Email         | Resend SDK (HTTP API)   | `StubEmailProvider`                      | No HTTP calls; stores sent emails in-memory array   |
| SMS           | Twilio SDK (HTTP API)   | `StubSmsProvider`                        | No HTTP calls; stores sent messages in-memory array |
| Geo service   | gRPC to .NET Geo.API    | Real .NET child process                  | Full parity (real Testcontainers PG + Redis)        |
| PostgreSQL    | Managed / cloud         | Testcontainers `postgres:18`             | Same image, ephemeral (destroyed after test run)    |
| Redis         | Managed / cloud         | Testcontainers `redis:8.2`               | Same image, ephemeral (destroyed after test run)    |
| RabbitMQ      | Managed / cloud         | Testcontainers `rabbitmq:4.1-management` | Same image, ephemeral                               |
| Auth service  | Standalone Hono process | In-process (`createApp`)                 | Same code, no network hop (direct function calls)   |
| Comms service | Standalone gRPC process | In-process (DI wired)                    | Same code, no network hop (direct consumer wiring)  |

### What Stubs Capture

| Stub                | Captured Fields                                                         | Assertion Access                                                  |
| ------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `StubEmailProvider` | `to`, `subject`, `html`, `plainText`, `providerMessageId`, `capturedAt` | `getSentEmails()`, `getLastEmail()`, `sentCount()`, `clear()`     |
| `StubSmsProvider`   | `to`, `body`, `providerMessageId`, `capturedAt`                         | `getSentMessages()`, `getLastMessage()`, `sentCount()`, `clear()` |

### Key Invariants

- **No mock boundaries**: Inter-service calls (Auth → Geo gRPC, Comms → Geo gRPC) use real gRPC over localhost. Only external HTTP APIs (Resend, Twilio) are stubbed.
- **Same DB schema**: Testcontainers run the same PostgreSQL image and Drizzle migrations as production. Schema drift is impossible.
- **Same message format**: RabbitMQ messages use the same JSON serialization as production. No message shape shortcuts.

---

## Playwright Browser E2E Tests

Browser-level tests that drive real Chromium against the full production stack: SvelteKit dev server → Auth service → Geo service (gRPC) → Comms service (RabbitMQ). These validate auth flows as a real user experiences them — form interactions, redirects, error messages, and session state.

### Pipeline Under Test (Browser)

```
Chromium browser
  └── SvelteKit dev server (child process, random port)
        ├── /api/auth/* proxy ──HTTP──► Auth service (Hono, ephemeral port)
        │                                 ├── createUserContact hook ──gRPC──► .NET Geo.API
        │                                 ├── BetterAuth user/session management
        │                                 └── Publishes event ──RabbitMQ──► Comms notification consumer
        ├── SSR route guards (SessionResolver, JwtManager via @d2/auth-bff-client)
        └── Redis (distributed cache, session secondary storage)
```

### Infrastructure

Infrastructure is self-contained via Testcontainers — the same containers used by the Vitest API-level tests. The key difference is the addition of the SvelteKit dev server and an HTTP wrapper around the Auth service (Hono).

| Component  | Image / Runtime            | Purpose                                                               |
| ---------- | -------------------------- | --------------------------------------------------------------------- |
| PostgreSQL | `postgres:18`              | Single container, 3 databases: default (Geo), `e2e_auth`, `e2e_comms` |
| Redis      | `redis:8.2`                | Distributed cache + session secondary storage                         |
| RabbitMQ   | `rabbitmq:4.1-management`  | Async event bus (Auth → Comms)                                        |
| Geo.API    | .NET child process         | gRPC service for contacts + WhoIs                                     |
| Auth       | In-process + HTTP server   | BetterAuth + Hono, wrapped in `@hono/node-server` on ephemeral port   |
| Comms      | In-process (DI wired)      | Notification consumer + stub email provider                           |
| SvelteKit  | Child process (`pnpm dev`) | Dev server on random port, configured to proxy to Auth + Geo + Redis  |

### Lifecycle

Unlike the Vitest tests (which start/stop infrastructure per test file in `beforeAll`/`afterAll`), browser tests use Playwright's `globalSetup`/`globalTeardown` to start everything **once** for all browser test files.

**Startup order** (`src/browser/global-setup.ts`):

1. Start Testcontainers (PostgreSQL + RabbitMQ + Redis)
2. Start .NET Geo service (child process, `dotnet run --no-build`)
3. Start Auth service in-process (`createApp`) + wrap in HTTP server (`@hono/node-server`)
4. Start Comms service in-process (DI wired, stub email provider)
5. Start SvelteKit dev server (child process, `pnpm dev --port {random}`)
6. Export `SVELTEKIT_BASE_URL` and `AUTH_BASE_URL` env vars for Playwright config + tests

**Teardown order** (`src/browser/global-teardown.ts`): reverse of startup — SvelteKit → Comms → Auth → Geo → Containers.

### Playwright Configuration

| Setting      | Value                        | Reason                                                          |
| ------------ | ---------------------------- | --------------------------------------------------------------- |
| `testDir`    | `src/browser`                | Separates browser specs from Vitest API-level tests             |
| `timeout`    | 60,000 ms                    | Full-stack round-trips through SvelteKit + Auth + Geo + Comms   |
| `retries`    | 1                            | Infrastructure flakiness mitigation (container startup timing)  |
| `trace`      | `on-first-retry`             | Captures trace only when a test is retried (for debugging)      |
| `screenshot` | `only-on-failure`            | Captures screenshot on failure for CI debugging                 |
| `baseURL`    | `SVELTEKIT_BASE_URL` env var | Set dynamically by global-setup to the SvelteKit dev server URL |
| `reporter`   | `html` (open: never)         | HTML report generated but not auto-opened (CI-friendly)         |

Run: `npx playwright test --config playwright.config.ts` (from the e2e project directory)

CI job: `e2e-browser` (separate from the Vitest `e2e-auth`, `e2e-comms`, `e2e-infra` jobs)

### Browser Test Files

#### `auth-sign-up.spec.ts` (2 tests)

| Test                                                                      | Validates                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Sign-up with valid credentials creates user and redirects to verify-email | Fill form → submit → redirect to `/verify-email` with confirmation message |
| Sign-up with duplicate email shows error                                  | Second sign-up with same email shows "already exists" error                |

#### `auth-sign-in.spec.ts` (3 tests)

| Test                                                           | Validates                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Sign-in with valid credentials redirects to authenticated area | Fill email + password → submit → redirected away from `/sign-in` |
| Sign-in with wrong password shows error                        | Incorrect password → credential error shown, stays on `/sign-in` |
| Sign-in with non-existent email shows error                    | Unknown email → same credential error (no user enumeration)      |

Pre-creates a test user via the Auth API (`AUTH_BASE_URL`) in `beforeAll` so sign-in tests have a valid account.

#### `auth-sign-out.spec.ts` (1 test)

| Test                                                           | Validates                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| Sign out after sign in clears session and redirects to sign-in | Sign in → find sign-out button → click → end up on `/sign-in` |

#### `auth-password-reset.spec.ts` (3 tests)

| Test                                                         | Validates                                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Forgot password form submits and shows confirmation          | Enter email → submit → success message shown                                  |
| Forgot password with unknown email still shows confirmation  | No user enumeration — unknown email gets same confirmation                    |
| Reset password page without token shows invalid link message | Navigate to `/reset-password` without token → shows "Invalid or Expired Link" |

### Browser E2E Helpers

```
src/
  browser/
    global-setup.ts           Starts all infrastructure + services + SvelteKit (runs once)
    global-teardown.ts        Stops everything in reverse order (runs once)
    auth-sign-up.spec.ts      Sign-up flow (form fill, redirect, duplicate detection)
    auth-sign-in.spec.ts      Sign-in flow (valid/invalid credentials, no enumeration)
    auth-sign-out.spec.ts     Sign-out flow (session clear, redirect)
    auth-password-reset.spec.ts  Password reset request + reset page without token
  helpers/
    sveltekit-server.ts       Start/stop SvelteKit dev server as child process
    auth-http-server.ts       Wraps Hono app in @hono/node-server on ephemeral port
```

#### `sveltekit-server.ts`

Starts the SvelteKit dev server as a child process (`pnpm dev --port {random}`). Configures environment variables to point at the running Auth, Geo, and Redis services: `SVELTEKIT_AUTH__URL`, `GEO_GRPC_ADDRESS`, `SVELTEKIT_GEO_CLIENT__APIKEY`, `REDIS_URL`. Disables OTel (`OTEL_SDK_DISABLED=true`). Polls the server URL until it responds (60s timeout). Same child-process pattern as `geo-dotnet-service.ts`.

#### `auth-http-server.ts`

Wraps a Hono app instance in a real HTTP server via `@hono/node-server` on an ephemeral port (`:0`). Returns a `baseUrl` and `close()` function. Needed because the browser tests access Auth through SvelteKit's proxy (`/api/auth/*`), which requires a real HTTP endpoint — the in-process Hono app alone is not sufficient.
