# @d2/auth-app

CQRS handlers and repository interfaces for the Auth service application layer. Zero BetterAuth imports — pure business logic that depends only on domain types and shared infrastructure.

## Purpose

Defines the CQRS handler layer between the API (routes) and infrastructure (repositories, BetterAuth). Handlers validate input via Zod, enforce business rules from `@d2/auth-domain`, and delegate persistence to repository handler interfaces that are implemented in `@d2/auth-infra`.

## Design Decisions

| Decision                            | Rationale                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Interfaces defined here, not infra  | Prevents circular dependency (infra cannot import from app)                      |
| Repository handler bundles          | Group related repo handlers into typed objects for factory convenience            |
| Handler-per-operation               | One class per CQRS operation — matches .NET Geo pattern and `BaseHandler` model  |
| Zod validation at handler boundary  | `this.validateInput(schema, input)` before any persistence or external calls     |
| Geo contact ops via geo-client      | Org contacts are junctions — actual contact data lives in Geo service (gRPC)     |
| Fail-open throttle handlers         | All store errors swallowed — sign-in availability > throttle accuracy            |
| ISignInThrottleStore interface      | Non-handler contract (stateful Redis store) — structurally implemented in infra  |
| DI registration via `addAuthApp()`  | Mirrors .NET `services.AddAuthApp()` — all handlers registered as transient      |
| Service keys alongside interfaces  | Keys live in app (with interfaces), infra re-exports for composition root access |

## Package Structure

```
src/
  index.ts                  Barrel exports + factory functions
  registration.ts           addAuthApp(services, options) DI registration
  service-keys.ts           ServiceKey<T> tokens (15 infra + 12 app)
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
          delete-org-contact-record.ts         IDeleteOrgContactRecordHandler
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
        q/
          get-sign-in-events.ts          GetSignInEvents
          get-active-consents.ts         GetActiveConsents
          get-org-contacts.ts            GetOrgContacts
          check-sign-in-throttle.ts      CheckSignInThrottle
```

## CQRS Handlers

### Command Handlers (8)

| Handler                  | Input                          | Output                         | Description                                                         |
| ------------------------ | ------------------------------ | ------------------------------ | ------------------------------------------------------------------- |
| `RecordSignInEvent`      | userId, successful, IP, UA     | `{ event }`                    | Creates immutable audit record via domain factory + repo            |
| `RecordSignInOutcome`    | identifierHash, identityHash   | `{ recorded }`                 | Records throttle state: success marks known-good, failure increments |
| `CreateEmulationConsent` | userId, grantedToOrgId, expiry | `{ consent }`                  | Validates org type, checks org exists, prevents duplicates          |
| `RevokeEmulationConsent` | consentId, userId              | `{ consent }`                  | Ownership check + active check before revoking                      |
| `CreateOrgContact`       | orgId, label, contact details  | `{ contact, geoContact }`     | Creates junction then Geo contact; rollback on Geo failure          |
| `UpdateOrgContactHandler`| id, orgId, updates             | `{ contact, geoContact? }`    | Metadata-only or contact replacement via UpdateContactsByExtKeys    |
| `DeleteOrgContact`       | id, orgId                      | `{}`                           | IDOR check, best-effort Geo delete, then junction delete            |
| `CreateUserContact`      | userId, email, name            | `{ contact }`                  | Sign-up hook: Geo contact with contextKey=auth_user. Fail-fast      |

### Query Handlers (4)

| Handler              | Input                | Output              | Description                                                        |
| -------------------- | -------------------- | ------------------- | ------------------------------------------------------------------ |
| `GetSignInEvents`    | userId, limit, offset| `{ events, total }` | Paginated with local cache + staleness check (append-only data)    |
| `GetActiveConsents`  | userId, limit, offset| `{ consents }`      | Active (non-revoked, non-expired) emulation consents               |
| `GetOrgContacts`     | orgId, limit, offset | `{ contacts[] }`    | Junction records hydrated with Geo contact data via ext-key lookup |
| `CheckSignInThrottle`| identifierHash, etc. | `{ blocked, retry?}`| Optimized Redis round-trips: 0 on local cache hit, 1 otherwise    |

## Repository Handler Interfaces

Defined as `IHandler<TInput, TOutput>` interfaces, grouped into aggregate bundles:

| Bundle                         | Handlers | Operations                                               |
| ------------------------------ | -------- | -------------------------------------------------------- |
| `SignInEventRepoHandlers`      | 4        | create, findByUserId, countByUserId, getLatestEventDate  |
| `EmulationConsentRepoHandlers` | 5        | create, findById, findActiveByUserId, findByUserAndOrg, revoke |
| `OrgContactRepoHandlers`      | 5        | create, findById, findByOrgId, update, delete            |

Plus `ISignInThrottleStore` (non-handler interface with 6 methods for Redis key operations).

## Service Keys

27 `ServiceKey<T>` tokens organized in two groups:

- **15 infra-layer keys** — for repository handlers and throttle store (interfaces defined here, implemented in `@d2/auth-infra`)
- **12 app-layer keys** — for CQRS handlers (defined and implemented here)

## DI Registration

```typescript
addAuthApp(services: ServiceCollection, options: AddAuthAppOptions): void
```

Registers all 12 CQRS handlers as **transient** (new instance per resolve). Each handler receives its repository dependencies and `IHandlerContext` from the DI container. The `options.checkOrgExists` callback is provided by the composition root.

## Factory Functions

Legacy factory functions (pre-DI) are still exported for backward compatibility and tests:

| Factory                           | Returns                                       |
| --------------------------------- | --------------------------------------------- |
| `createSignInEventHandlers()`     | `{ record, getByUser }`                       |
| `createEmulationConsentHandlers()`| `{ create, revoke, getActive }`               |
| `createOrgContactHandlers()`      | `{ create, update, delete, getByOrg }`        |
| `createSignInThrottleHandlers()`  | `{ check, record }`                           |
| `createUserContactHandler()`      | `CreateUserContact` instance                  |

## Dependencies

| Package            | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `@d2/auth-domain`  | Domain entities, rules, constants, enums         |
| `@d2/di`           | `createServiceKey`, `ServiceCollection`          |
| `@d2/geo-client`   | Geo contact handler types, `contactInputSchema`  |
| `@d2/handler`      | `BaseHandler`, `IHandlerContext`, Zod helpers    |
| `@d2/interfaces`   | `InMemoryCache` handler types for caching        |
| `@d2/protos`       | `ContactDTO`, `ContactToCreateDTO` proto types   |
| `@d2/result`       | `D2Result`, `HttpStatusCode`, `ErrorCodes`       |
| `@d2/utilities`    | `generateUuidV7`                                 |
| `zod`              | Input validation schemas                         |

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
```

Run: `pnpm vitest run --project auth-tests`
