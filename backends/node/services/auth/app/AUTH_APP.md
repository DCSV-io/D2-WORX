# @d2/auth-app

CQRS handlers and repository interfaces for the Auth service application layer. Zero BetterAuth imports — pure business logic that depends only on domain types and shared infrastructure.

## Purpose

Defines the CQRS handler layer between the API (routes) and infrastructure (repositories, BetterAuth). Handlers validate input via Zod, enforce business rules from `@d2/auth-domain`, and delegate persistence to repository handler interfaces that are implemented in `@d2/auth-infra`.

## Design Decisions

| Decision                           | Rationale                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Interfaces defined here, not infra | Prevents circular dependency (infra cannot import from app)                      |
| Repository handler bundles         | Group related repo handlers into typed objects for factory convenience           |
| Handler-per-operation              | One class per CQRS operation — matches .NET Geo pattern and `BaseHandler` model  |
| Zod validation at handler boundary | `this.validateInput(schema, input)` before any persistence or external calls     |
| Geo contact ops via geo-client     | Org contacts are junctions — actual contact data lives in Geo service (gRPC)     |
| Fail-open throttle handlers        | All store errors swallowed — sign-in availability > throttle accuracy            |
| ISignInThrottleStore interface     | Non-handler contract (stateful Redis store) — structurally implemented in infra  |
| DI registration via `addAuthApp()` | Mirrors .NET `services.AddAuthApp()` — all handlers registered as transient      |
| Service keys alongside interfaces  | Keys live in app (with interfaces), infra re-exports for composition root access |

## Package Structure

```
src/
  index.ts                  Barrel exports + factory functions
  registration.ts           addAuthApp(services, options) DI registration
  auth-job-options.ts       AuthJobOptions interface + DEFAULT_AUTH_JOB_OPTIONS
  service-keys.ts           ServiceKey<T> tokens (21 infra + 17 app)
  interfaces/
    repository/
      sign-in-throttle-store.ts    ISignInThrottleStore (non-handler contract)
      handlers/
        index.ts                   Re-exports + bundle interfaces
        c/
          create-sign-in-event.ts          ICreateSignInEventHandler
          create-emulation-consent-record.ts  ICreateEmulationConsentRecordHandler
          create-org-contact-record.ts     ICreateOrgContactRecordHandler
        r/
          find-sign-in-events-by-user-id.ts       IFindSignInEventsByUserIdHandler
          count-sign-in-events-by-user-id.ts      ICountSignInEventsByUserIdHandler
          get-latest-sign-in-event-date.ts        IGetLatestSignInEventDateHandler
          find-emulation-consent-by-id.ts         IFindEmulationConsentByIdHandler
          find-active-consents-by-user-id.ts      IFindActiveConsentsByUserIdHandler
          find-active-consent-by-user-id-and-org.ts  IFindActiveConsentByUserIdAndOrgHandler
          find-org-contact-by-id.ts               IFindOrgContactByIdHandler
          find-org-contacts-by-org-id.ts          IFindOrgContactsByOrgIdHandler
        u/
          revoke-emulation-consent-record.ts   IRevokeEmulationConsentRecordHandler
          update-org-contact-record.ts         IUpdateOrgContactRecordHandler
        d/
          delete-org-contact-record.ts                IDeleteOrgContactRecordHandler
          purge-expired-sessions.ts                   IPurgeExpiredSessionsHandler
          purge-sign-in-events.ts                     IPurgeSignInEventsHandler
          purge-expired-invitations.ts                IPurgeExpiredInvitationsHandler
          purge-expired-emulation-consents.ts         IPurgeExpiredEmulationConsentsHandler
  implementations/
    cqrs/
      handlers/
        c/
          record-sign-in-event.ts        RecordSignInEvent
          record-sign-in-outcome.ts      RecordSignInOutcome
          create-emulation-consent.ts    CreateEmulationConsent
          revoke-emulation-consent.ts    RevokeEmulationConsent
          create-org-contact.ts          CreateOrgContact
          update-org-contact.ts          UpdateOrgContactHandler
          delete-org-contact.ts          DeleteOrgContact
          create-user-contact.ts         CreateUserContact
          run-session-purge.ts           RunSessionPurge
          run-sign-in-event-purge.ts     RunSignInEventPurge
          run-invitation-cleanup.ts      RunInvitationCleanup
          run-emulation-consent-cleanup.ts  RunEmulationConsentCleanup
        q/
          get-sign-in-events.ts          GetSignInEvents
          get-active-consents.ts         GetActiveConsents
          get-org-contacts.ts            GetOrgContacts
          check-sign-in-throttle.ts      CheckSignInThrottle
```

## CQRS Handlers

### Command Handlers (8)

| Handler                   | Input                          | Output                     | Description                                                          |
| ------------------------- | ------------------------------ | -------------------------- | -------------------------------------------------------------------- |
| `RecordSignInEvent`       | userId, successful, IP, UA     | `{ event }`                | Creates immutable audit record via domain factory + repo             |
| `RecordSignInOutcome`     | identifierHash, identityHash   | `{ recorded }`             | Records throttle state: success marks known-good, failure increments |
| `CreateEmulationConsent`  | userId, grantedToOrgId, expiry | `{ consent }`              | Validates org type, checks org exists, prevents duplicates           |
| `RevokeEmulationConsent`  | consentId, userId              | `{ consent }`              | Ownership check + active check before revoking                       |
| `CreateOrgContact`        | orgId, label, contact details  | `{ contact, geoContact }`  | Creates junction then Geo contact; rollback on Geo failure           |
| `UpdateOrgContactHandler` | id, orgId, updates             | `{ contact, geoContact? }` | Metadata-only or contact replacement via UpdateContactsByExtKeys     |
| `DeleteOrgContact`        | id, orgId                      | `{}`                       | IDOR check, best-effort Geo delete, then junction delete             |
| `CreateUserContact`       | userId, email, name            | `{ contact }`              | Sign-up hook: Geo contact with contextKey=auth_user. Fail-fast       |

### Job Handlers (4)

Scheduled job orchestrators that acquire a distributed lock (Redis), delegate to a repository purge handler, and release the lock in a `finally` block. All return `{ rowsAffected, lockAcquired, durationMs }`. If the lock is already held, the handler returns immediately with `lockAcquired: false`.

| Handler                      | Lock Key                                      | Repo Handler                            | Cutoff Logic                                    |
| ---------------------------- | --------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| `RunSessionPurge`            | `lock:job:purge-expired-sessions`             | `IPurgeExpiredSessionsHandler`          | Sessions past `expiresAt` (BetterAuth-managed)  |
| `RunSignInEventPurge`        | `lock:job:purge-sign-in-events`               | `IPurgeSignInEventsHandler`             | Events older than `signInEventRetentionDays`    |
| `RunInvitationCleanup`       | `lock:job:cleanup-expired-invitations`        | `IPurgeExpiredInvitationsHandler`       | Invitations past `expiresAt` + retention buffer |
| `RunEmulationConsentCleanup` | `lock:job:cleanup-expired-emulation-consents` | `IPurgeExpiredEmulationConsentsHandler` | Expired OR already-revoked consents             |

### Query Handlers (5)

| Handler               | Input                 | Output               | Description                                                        |
| --------------------- | --------------------- | -------------------- | ------------------------------------------------------------------ |
| `GetSignInEvents`     | userId, limit, offset | `{ events, total }`  | Paginated with local cache + staleness check (append-only data)    |
| `GetActiveConsents`   | userId, limit, offset | `{ consents }`       | Active (non-revoked, non-expired) emulation consents               |
| `GetOrgContacts`      | orgId, limit, offset  | `{ contacts[] }`     | Junction records hydrated with Geo contact data via ext-key lookup |
| `CheckSignInThrottle` | identifierHash, etc.  | `{ blocked, retry?}` | Optimized Redis round-trips: 0 on local cache hit, 1 otherwise     |
| `CheckHealth`         | _(none)_              | `{ status, ... }`    | Aggregates DB, cache, and message bus pings into health report     |

## Repository Handler Interfaces

Defined as `IHandler<TInput, TOutput>` interfaces, grouped into aggregate bundles:

| Bundle                         | Handlers | Operations                                                           |
| ------------------------------ | -------- | -------------------------------------------------------------------- |
| `SignInEventRepoHandlers`      | 5        | create, findByUserId, countByUserId, getLatestEventDate, updateWhoIs |
| `EmulationConsentRepoHandlers` | 5        | create, findById, findActiveByUserId, findByUserAndOrg, revoke       |
| `OrgContactRepoHandlers`       | 5        | create, findById, findByOrgId, update, delete                        |

Plus 4 standalone purge handlers (not bundled — used by job handlers via DI):

| Interface                               | Input      | Output             | Description                                   |
| --------------------------------------- | ---------- | ------------------ | --------------------------------------------- |
| `IPurgeExpiredSessionsHandler`          | _(empty)_  | `{ rowsAffected }` | Deletes sessions past `expiresAt`             |
| `IPurgeSignInEventsHandler`             | cutoffDate | `{ rowsAffected }` | Deletes sign-in events before cutoff          |
| `IPurgeExpiredInvitationsHandler`       | cutoffDate | `{ rowsAffected }` | Deletes invitations past `expiresAt` + buffer |
| `IPurgeExpiredEmulationConsentsHandler` | _(empty)_  | `{ rowsAffected }` | Deletes expired or revoked emulation consents |

Plus `ISignInThrottleStore` (non-handler interface with 6 methods for Redis key operations).

## Service Keys

38 `ServiceKey<T>` tokens organized in two groups:

- **21 infra-layer keys** — for repository handlers, PingDb, throttle store, and 4 purge handlers (interfaces defined here, implemented in `@d2/auth-infra`)
- **17 app-layer keys** — for CQRS handlers including CheckHealth and 4 job handlers (defined and implemented here)

## AuthJobOptions

Configuration for scheduled job handlers, provided via `addAuthApp()` (defaults to `DEFAULT_AUTH_JOB_OPTIONS`):

| Property                   | Type     | Default  | Description                                         |
| -------------------------- | -------- | -------- | --------------------------------------------------- |
| `signInEventRetentionDays` | `number` | `90`     | Days to retain sign-in events before purge          |
| `invitationRetentionDays`  | `number` | `7`      | Days past expiry to retain invitations before purge |
| `lockTtlMs`                | `number` | `300000` | Distributed lock TTL in milliseconds (5 min)        |

## DI Registration

```typescript
addAuthApp(services: ServiceCollection, options: AddAuthAppOptions, jobOptions?: AuthJobOptions): void
```

Registers all 17 CQRS handlers as **transient** (new instance per resolve). Each handler receives its repository dependencies and `IHandlerContext` from the DI container. The `options.checkOrgExists` callback is provided by the composition root. The optional `jobOptions` parameter (defaults to `DEFAULT_AUTH_JOB_OPTIONS`) configures retention periods and lock TTL for job handlers. Infra-layer purge handlers use `DEFAULT_BATCH_SIZE` (500) from `@d2/batch-pg` internally -- batch size is not passed via handler input.

## Factory Functions

Legacy factory functions (pre-DI) are still exported for backward compatibility and tests:

| Factory                            | Returns                                |
| ---------------------------------- | -------------------------------------- |
| `createSignInEventHandlers()`      | `{ record, getByUser }`                |
| `createEmulationConsentHandlers()` | `{ create, revoke, getActive }`        |
| `createOrgContactHandlers()`       | `{ create, update, delete, getByOrg }` |
| `createSignInThrottleHandlers()`   | `{ check, record }`                    |
| `createUserContactHandler()`       | `CreateUserContact` instance           |

## Dependencies

| Package           | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `@d2/auth-domain` | Domain entities, rules, constants, enums           |
| `@d2/di`          | `createServiceKey`, `ServiceCollection`            |
| `@d2/geo-client`  | Geo contact handler types, `contactInputSchema`    |
| `@d2/handler`     | `BaseHandler`, `IHandlerContext`, Zod helpers      |
| `@d2/cache-redis` | Lock key factories for job handler DI registration |
| `@d2/interfaces`  | `InMemoryCache` + `DistributedCache` handler types |
| `@d2/protos`      | `ContactDTO`, `ContactToCreateDTO` proto types     |
| `@d2/result`      | `D2Result`, `HttpStatusCode`, `ErrorCodes`         |
| `@d2/utilities`   | `generateUuidV7`                                   |
| `zod`             | Input validation schemas                           |

## Tests

All tests are in `@d2/auth-tests` (`backends/node/services/auth/tests/`):

```
src/unit/app/handlers/
  c/   record-sign-in-event.test.ts, record-sign-in-outcome.test.ts,
       create-emulation-consent.test.ts, revoke-emulation-consent.test.ts,
       create-org-contact.test.ts, update-org-contact.test.ts,
       delete-org-contact.test.ts, create-user-contact.test.ts
  q/   get-sign-in-events.test.ts, get-active-consents.test.ts,
       get-org-contacts.test.ts, check-sign-in-throttle.test.ts
src/unit/jobs/
       run-session-purge.test.ts, run-sign-in-event-purge.test.ts,
       run-invitation-cleanup.test.ts, run-emulation-consent-cleanup.test.ts
src/integration/
       job-purge-handlers.test.ts   (PurgeExpiredSessions, PurgeSignInEvents,
                                      PurgeExpiredInvitations, PurgeExpiredEmulationConsents)
```

Run: `pnpm vitest run --project auth-tests`
