# @d2/auth-api

Hono HTTP server, composition root, route definitions, and middleware for the Auth service. Wires together all DDD layers (`@d2/auth-domain`, `@d2/auth-app`, `@d2/auth-infra`) with shared infrastructure packages into a running service.

## Purpose

Serves as the entry point and composition root for the Auth service. Creates the Hono HTTP application with middleware pipeline, mounts BetterAuth at `/api/auth/*`, exposes custom authenticated routes for emulation, org contacts, and invitations, and manages service lifecycle (startup, shutdown).

## Design Decisions

| Decision                            | Rationale                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Composition root in `createApp()`   | Mirrors .NET `Program.cs` — single function wires all dependencies                 |
| DI scope per protected request      | `createScopeMiddleware(provider)` builds `IRequestContext` + `IHandlerContext`     |
| Pre-auth handlers as singletons     | FindWhoIs, RateLimit, Throttle run before authentication — not in DI scope         |
| AsyncLocalStorage for fingerprint   | JWT `definePayload` runs in BetterAuth context — needs per-request fingerprint     |
| Thin route handlers                 | Routes extract input from request, resolve handler from DI scope, return result    |
| Auth middleware visible at route    | `requireOrg()`, `requireRole()`, `requireStaff()` declared inline for auditability |
| AppOverrides for testability        | Tests inject stub password functions to skip HIBP API calls                        |
| Separate Hono apps for route groups | Auth routes, protected routes, and health mounted as sub-apps                      |

## Package Structure

```
src/
  index.ts                  Barrel exports (createApp, middleware, routes)
  main.ts                   Production entry point (OTel, env vars, serve)
  composition-root.ts       createApp() — DI wiring, BetterAuth, Hono pipeline
  geo/                      Geo client configuration (context keys, caching)
  middleware/
    authorization.ts        requireOrg, requireOrgType, requireRole, requireStaff, requireAdmin
    cors.ts                 CORS middleware factory
    csrf.ts                 CSRF protection (Origin header validation)
    distributed-rate-limit.ts  Rate limiting middleware (Redis sliding window)
    error-handler.ts        Global error handler (D2Result formatting)
    request-enrichment.ts   IP resolution, fingerprinting, WhoIs lookup
    scope.ts                Per-request DI scope (IRequestContext, IHandlerContext)
    session.ts              BetterAuth session extraction (user + session on context)
    session-fingerprint.ts  Session-to-fingerprint binding (stolen token detection)
  routes/
    auth-routes.ts          BetterAuth catch-all + throttled sign-in endpoints
    emulation-routes.ts     Emulation consent CRUD (POST, DELETE, GET)
    health.ts               Health check endpoint
    invitation-routes.ts    Org invitation with dual-path contact resolution
    org-contact-routes.ts   Org contact CRUD (POST, PATCH, DELETE, GET)
```

## Composition Root

`createApp(config, publisher?, overrides?)` performs startup in order:

| Step | Action                                                                               |
| ---- | ------------------------------------------------------------------------------------ |
| 1    | Create singletons: `pg.Pool`, `ioredis`, Pino logger                                 |
| 2    | Run Drizzle migrations, create Drizzle instance                                      |
| 3    | Build `ServiceCollection` — register logger, handler context, cache, geo, infra, app |
| 4    | Build `ServiceProvider`                                                              |
| 5    | Create pre-auth singletons (FindWhoIs, RateLimitCheck, Throttle handlers)            |
| 6    | Create password functions (domain validation + HIBP k-anonymity cache)               |
| 7    | Create BetterAuth instance with scoped callback hooks                                |
| 8    | Configure session fingerprint middleware (Redis-backed, 7-day TTL)                   |
| 9    | Build Hono app with global + route-specific middleware                               |

Returns `{ app, auth, shutdown }`.

## Middleware Pipeline

### Global (all requests)

| Order | Middleware             | Purpose                                         |
| ----- | ---------------------- | ----------------------------------------------- |
| 1     | CORS                   | Allows configured SvelteKit origin              |
| 2     | Body limit             | 256 KB max (auth payloads are small JSON)       |
| 3     | Request enrichment     | IP resolution, server fingerprint, WhoIs lookup |
| 4     | Distributed rate limit | Multi-dimensional sliding window (Redis)        |
| 5     | Error handler          | Catches unhandled errors, returns D2Result      |

### Auth routes (`/api/auth/*`)

| Order | Middleware             | Purpose                                                 |
| ----- | ---------------------- | ------------------------------------------------------- |
| 1     | Session fingerprint    | Binds/validates fingerprint to session token            |
| 2     | Fingerprint AsyncLocal | Stores fingerprint in AsyncLocalStorage for JWT payload |
| 3     | BetterAuth handler     | Delegates to BetterAuth (with throttle on sign-in)      |

### Protected routes (emulation, contacts, invitations)

| Order | Middleware          | Purpose                                               |
| ----- | ------------------- | ----------------------------------------------------- |
| 1     | Session             | Extracts user + session from BetterAuth (401 if none) |
| 2     | Session fingerprint | Validates fingerprint continuity                      |
| 3     | DI scope            | Creates per-request scope with IRequestContext        |
| 4     | CSRF                | Origin header validation                              |

## Routes

### Health

| Method | Path      | Auth | Description                     |
| ------ | --------- | ---- | ------------------------------- |
| GET    | `/health` | No   | Returns `{ status, timestamp }` |

### Auth (BetterAuth)

| Method | Path                         | Auth       | Description                               |
| ------ | ---------------------------- | ---------- | ----------------------------------------- |
| POST   | `/api/auth/sign-in/email`    | No         | Email sign-in with throttle guard         |
| POST   | `/api/auth/sign-in/username` | No         | Username sign-in with throttle guard      |
| ALL    | `/api/auth/*`                | BetterAuth | Catch-all for all other BetterAuth routes |

Sign-in throttle flow: extract identifier, check throttle (429 if blocked), forward to BetterAuth, record outcome (fire-and-forget). JWKS/discovery responses get `Cache-Control: public, max-age=3600`.

### Emulation Consent

| Method | Path                         | Auth                         | Description                      |
| ------ | ---------------------------- | ---------------------------- | -------------------------------- |
| POST   | `/api/emulation/consent`     | requireOrg + staff + officer | Create consent for target org    |
| DELETE | `/api/emulation/consent/:id` | requireOrg + staff + officer | Revoke consent by ID             |
| GET    | `/api/emulation/consent`     | requireOrg + staff           | List active consents (paginated) |

### Org Contacts

| Method | Path                    | Auth                 | Description                             |
| ------ | ----------------------- | -------------------- | --------------------------------------- |
| POST   | `/api/org-contacts`     | requireOrg + officer | Create contact (junction + Geo contact) |
| PATCH  | `/api/org-contacts/:id` | requireOrg + officer | Update metadata and/or contact data     |
| DELETE | `/api/org-contacts/:id` | requireOrg + officer | Delete junction + Geo contact           |
| GET    | `/api/org-contacts`     | requireOrg           | List contacts hydrated with Geo data    |

### Invitations

| Method | Path               | Auth                 | Description                                         |
| ------ | ------------------ | -------------------- | --------------------------------------------------- |
| POST   | `/api/invitations` | requireOrg + officer | Create invitation with dual-path contact resolution |

Invitation flow: validate input, look up user by email, create BetterAuth invitation, create Geo contact for non-existing invitees (contextKey=auth_org_invitation), resolve recipient contactId (via ext-keys for existing users), publish notification via comms-client.

## Authorization Middleware

| Middleware         | Purpose                                                  |
| ------------------ | -------------------------------------------------------- |
| `requireOrg()`     | Active org required (orgId + valid orgType + valid role) |
| `requireOrgType()` | Session orgType must be in allowed set                   |
| `requireRole()`    | Session role must meet minimum hierarchy level           |
| `requireStaff()`   | Shorthand for `requireOrgType("admin", "support")`       |
| `requireAdmin()`   | Shorthand for `requireOrgType("admin")`                  |

## Configuration

`AuthServiceConfig` fields (from `@d2/auth-infra`):

| Field                  | Required | Default                      |
| ---------------------- | -------- | ---------------------------- |
| `databaseUrl`          | Yes      | —                            |
| `redisUrl`             | Yes      | —                            |
| `rabbitMqUrl`          | No       | — (events logged, not sent)  |
| `baseUrl`              | Yes      | —                            |
| `corsOrigin`           | Yes      | —                            |
| `jwtIssuer`            | Yes      | —                            |
| `jwtAudience`          | Yes      | —                            |
| `jwtExpirationSeconds` | No       | 900 (15 min)                 |
| `jwksRotationDays`     | No       | 30                           |
| `geoAddress`           | No       | — (contact ops fail without) |
| `geoApiKey`            | No       | — (contact ops fail without) |

## Dependencies

| Package                  | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| `@d2/auth-app`           | CQRS handlers, service keys                            |
| `@d2/auth-domain`        | Constants, enums, session fields                       |
| `@d2/auth-infra`         | BetterAuth factory, config, migrations, throttle       |
| `@d2/cache-memory`       | Local caches (WhoIs, throttle, contacts, HIBP)         |
| `@d2/cache-redis`        | Redis handlers (session storage, throttle, rate limit) |
| `@d2/comms-client`       | `INotifyKey` for sending notifications via comms       |
| `@d2/di`                 | `ServiceCollection`, `ServiceProvider`                 |
| `@d2/geo-client`         | Geo contact CRUD handlers + FindWhoIs                  |
| `@d2/handler`            | `HandlerContext`, `IHandlerContextKey`                 |
| `@d2/logging`            | Pino logger creation                                   |
| `@d2/messaging`          | RabbitMQ `MessageBus` + `IMessagePublisher`            |
| `@d2/ratelimit`          | Distributed rate limit check                           |
| `@d2/request-enrichment` | IP/fingerprint/WhoIs middleware (imported indirectly)  |
| `@d2/result`             | `D2Result`, `HttpStatusCode`                           |
| `@d2/service-defaults`   | `setupTelemetry()` (OTel SDK bootstrap)                |
| `@d2/utilities`          | General utilities                                      |
| `hono`                   | HTTP framework                                         |
| `@hono/node-server`      | Node.js adapter for Hono                               |
| `ioredis`                | Redis client (direct for session fingerprint binding)  |
| `drizzle-orm`            | Database queries in invitation routes                  |
| `pg`                     | PostgreSQL connection pool                             |

## Tests

All tests are in `@d2/auth-tests` (`backends/node/services/auth/tests/`):

```
src/unit/api/
  middleware/
    authorization.test.ts, csrf.test.ts, error-handler.test.ts,
    jwt-fingerprint.test.ts, scope.test.ts, session.test.ts,
    session-fingerprint.test.ts
  routes/
    auth-routes.test.ts, emulation-routes.test.ts,
    invitation-routes.test.ts, org-contact-routes.test.ts
```

Run: `pnpm vitest run --project auth-tests`
