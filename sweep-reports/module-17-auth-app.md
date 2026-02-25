### Module 17: Auth App

**Files reviewed**: 33 source files

**Source files**:

| # | File                                                                  | Lines |
|---|-----------------------------------------------------------------------|-------|
| 1 | `implementations/cqrs/handlers/c/create-emulation-consent.ts`        | 115   |
| 2 | `implementations/cqrs/handlers/c/create-org-contact.ts`              | 142   |
| 3 | `implementations/cqrs/handlers/c/create-user-contact.ts`             | 83    |
| 4 | `implementations/cqrs/handlers/c/delete-org-contact.ts`              | 84    |
| 5 | `implementations/cqrs/handlers/c/record-sign-in-event.ts`            | 60    |
| 6 | `implementations/cqrs/handlers/c/record-sign-in-outcome.ts`          | 107   |
| 7 | `implementations/cqrs/handlers/c/revoke-emulation-consent.ts`        | 81    |
| 8 | `implementations/cqrs/handlers/c/update-org-contact.ts`              | 142   |
| 9 | `implementations/cqrs/handlers/q/check-health.ts`                    | 95    |
| 10 | `implementations/cqrs/handlers/q/check-sign-in-throttle.ts`         | 99    |
| 11 | `implementations/cqrs/handlers/q/get-active-consents.ts`            | 53    |
| 12 | `implementations/cqrs/handlers/q/get-org-contacts.ts`               | 104   |
| 13 | `implementations/cqrs/handlers/q/get-sign-in-events.ts`             | 122   |
| 14 | `index.ts`                                                           | 306   |
| 15 | `interfaces/repository/handlers/c/create-emulation-consent-record.ts`| 13    |
| 16 | `interfaces/repository/handlers/c/create-org-contact-record.ts`      | 13    |
| 17 | `interfaces/repository/handlers/c/create-sign-in-event.ts`           | 10    |
| 18 | `interfaces/repository/handlers/d/delete-org-contact-record.ts`      | 12    |
| 19 | `interfaces/repository/handlers/index.ts`                            | 137   |
| 20 | `interfaces/repository/handlers/q/ping-db.ts`                        | 14    |
| 21 | `interfaces/repository/handlers/r/count-sign-in-events-by-user-id.ts`| 14    |
| 22 | `interfaces/repository/handlers/r/find-active-consent-by-user-id-and-org.ts` | 16 |
| 23 | `interfaces/repository/handlers/r/find-active-consents-by-user-id.ts`| 17    |
| 24 | `interfaces/repository/handlers/r/find-emulation-consent-by-id.ts`   | 15    |
| 25 | `interfaces/repository/handlers/r/find-org-contact-by-id.ts`         | 15    |
| 26 | `interfaces/repository/handlers/r/find-org-contacts-by-org-id.ts`    | 17    |
| 27 | `interfaces/repository/handlers/r/find-sign-in-events-by-user-id.ts` | 17    |
| 28 | `interfaces/repository/handlers/r/get-latest-sign-in-event-date.ts`  | 14    |
| 29 | `interfaces/repository/handlers/u/revoke-emulation-consent-record.ts`| 12    |
| 30 | `interfaces/repository/handlers/u/update-org-contact-record.ts`      | 13    |
| 31 | `interfaces/repository/sign-in-throttle-store.ts`                    | 25    |
| 32 | `registration.ts`                                                    | 190   |
| 33 | `service-keys.ts`                                                    | 137   |

All paths relative to `backends/node/services/auth/app/src/`.

---

**Assumptions documented**:

1. **Zero BetterAuth imports** -- the app layer is pure business logic with no BetterAuth dependency. All BetterAuth-specific behavior is isolated in auth-infra.
2. **Repository handlers are implemented in auth-infra** -- interfaces live in auth-app, implementations in auth-infra. Keys defined in auth-app, re-exported by auth-infra.
3. **Sign-in events are append-only** -- the cache staleness check in `GetSignInEvents` relies on the assumption that existing pages are stable if no new events exist.
4. **Events are ordered by createdAt DESC in infra** -- `GetSignInEvents` assumes `events[0]` is the most recent event on the page, validated by infra using `orderBy(desc(signInEvent.createdAt))`.
5. **Geo contacts are immutable** -- `CreateOrgContact`, `DeleteOrgContact`, and `UpdateOrgContact` assume Geo contacts are never updated in place; "update" means create-new + delete-old atomically via `UpdateContactsByExtKeys`.
6. **Fail-open for throttle handlers** -- `CheckSignInThrottle` and `RecordSignInOutcome` swallow all store errors to preserve sign-in availability over throttle accuracy.
7. **Fail-fast for user contact creation** -- `CreateUserContact` intentionally fails the entire sign-up if Geo is unavailable (no orphaned users without contacts).
8. **Best-effort Geo cleanup on delete** -- `DeleteOrgContact` swallows Geo deletion failures because Geo's background job handles orphan cleanup.
9. **Factory functions are legacy** -- pre-DI factory functions are maintained for backward compatibility and tests; the canonical path is DI via `addAuthApp()`.
10. **No input validation on `RecordSignInOutcome`, `CheckSignInThrottle`, `GetSignInEvents`, and `CheckHealth`** -- these handlers skip Zod validation. The throttle handlers receive pre-hashed strings from middleware; the health check has no meaningful input.
11. **Memory cache is optional** -- DI registration in `addAuthApp()` does not inject cache instances into handlers that accept them (`GetSignInEvents`, `CheckSignInThrottle`, `RecordSignInOutcome`). These handlers work correctly without cache; cache injection is reserved for factory function usage.
12. **`checkOrgExists` is injected from outside** -- `CreateEmulationConsent` receives this as a closure from the composition root, avoiding a direct dependency on BetterAuth org queries.

---

**Findings**:

| #  | Severity | Category       | File:Line                                                | Description |
|----|----------|----------------|----------------------------------------------------------|-------------|
| 1  | High     | Bug            | `handlers/q/get-sign-in-events.ts:107-108`               | **Cache staleness mismatch for non-zero offsets.** When populating the cache, `latestDate` is derived from `events[0].createdAt` (the first event on the *current page*). However, the staleness check on line 81-85 queries `getLatestEventDate` which returns the globally most-recent event date for the user. For pages with offset > 0, the page's first event will be older than the true latest, so the stored `latestDate` will never match the staleness check result. This means **caching is permanently broken for all pages except page 0**. Fix: query `getLatestEventDate` alongside `findByUserId` and `countByUserId` during the DB fetch path (line 97-99) and use that authoritative date when populating the cache. |
| 2  | Medium   | Consistency    | `handlers/c/record-sign-in-outcome.ts` (whole file)      | **Missing Zod validation.** CLAUDE.md mandates "All handlers MUST validate input" via Zod. `RecordSignInOutcome` accepts `identifierHash`, `identityHash`, and `responseStatus` with no schema validation. While these are pre-hashed internal values, the mandate is explicit. `@d2/comms-app` has the same gap in `RecipientResolver` and `Deliver`, so this is a cross-service consistency issue. |
| 3  | Medium   | Consistency    | `handlers/q/check-sign-in-throttle.ts` (whole file)      | **Missing Zod validation.** Same as finding #2 -- `CheckSignInThrottle` accepts `identifierHash` and `identityHash` without schema validation. At minimum, string length/format constraints would prevent unexpected input from reaching Redis. |
| 4  | Medium   | Consistency    | `handlers/q/get-sign-in-events.ts` (whole file)          | **Missing Zod validation.** `GetSignInEvents` accepts `userId`, `limit`, and `offset` without Zod validation. While `limit` and `offset` are clamped with `Math.min`/`Math.max` on line 69-70, `userId` is not validated as a UUID. Both `GetActiveConsents` and `GetOrgContacts` properly validate their inputs with Zod schemas including `zodGuid` for IDs. |
| 5  | Medium   | Security       | `handlers/c/create-user-contact.ts:21`                   | **`name` field allows empty string.** The schema uses `z.string().max(200)` which permits empty strings. Compare with `email` which correctly uses `zodNonEmptyString(320)`. A user registering with an empty name would create a Geo contact with no `firstName`. Should use `zodNonEmptyString(200)` or `z.string().min(1).max(200)`. |
| 6  | Medium   | Bug            | `handlers/q/get-sign-in-events.ts:81-85`                 | **Staleness check always queries DB even on cache hit.** When a cache entry exists, the handler still calls `getLatestEventDate` to verify staleness. This negates part of the cache benefit since every "cache hit" still incurs a DB round-trip. For the intended optimization (minimizing DB calls), consider storing the `latestDate` from `getLatestEventDate` in a *separate* short-TTL cache entry, or accepting a bounded staleness window without the DB check. |
| 7  | Medium   | Consistency    | `handlers/q/check-health.ts` vs comms `check-health.ts`  | **Auth CheckHealth includes cache ping; comms does not.** Auth's `CheckHealth` constructor takes `pingDb`, `pingCache`, and optional `pingMessageBus`. Comms' `CheckHealth` takes only `pingDb` and optional `pingMessageBus` -- no cache ping. Both services use Redis, so the comms service health check is missing cache health reporting. This is an inconsistency across services. |
| 8  | Medium   | Maintainability| `handlers/c/update-org-contact.ts:126-132`               | **Unsafe `Record<string, unknown>` cast for metadata updates.** Lines 128-131 cast `metadataUpdates` to `Record<string, unknown>` to assign `label` and `isPrimary`. This bypasses TypeScript's type system. The `UpdateOrgContactInput` type from auth-domain should already accept these optional fields. Consider using a properly typed spread or partial assignment instead. |
| 9  | Low      | Consistency    | `registration.ts` vs comms `registration.ts`             | **Auth `addAuthApp` takes options parameter; comms `addCommsApp` does not.** Auth's `addAuthApp(services, options)` receives a `checkOrgExists` callback externally. This is architecturally valid (prevents BetterAuth leaking into app layer), but is a structural divergence from the comms pattern. No action needed -- just documenting the difference. |
| 10 | Low      | Elegance       | `handlers/c/create-org-contact.ts:109-117`               | **`as ContactToCreateDTO` type assertion.** The object literal is cast to `ContactToCreateDTO` rather than being structurally typed. Same pattern in `update-org-contact.ts:101-109`. If the proto type changes, these assertions will silently mask type errors. Consider using a builder or satisfies operator. |
| 11 | Low      | Elegance       | `handlers/q/get-active-consents.ts:49`                   | **Silent failure on repo error.** `GetActiveConsents` returns an empty array if the repo call fails (line 49: `findResult.success ? ... : []`). The caller gets a success response with no consents, indistinguishable from "user has no consents." Same pattern in `GetSignInEvents` (lines 102-103). Consider propagating the failure via `bubbleFail` or logging a warning. |
| 12 | Low      | Elegance       | `handlers/q/get-org-contacts.ts:72`                      | **Same silent failure pattern.** `GetOrgContacts` returns empty array if repo fails. Consistent with finding #11 but worth noting -- the user sees an empty list when the DB is actually down. |
| 13 | Low      | Performance    | `handlers/q/get-org-contacts.ts:66-69`                   | **Limit/offset not applied to GetOrgContacts repo call.** The input `limit` and `offset` are passed through to `findByOrgId` but only if the caller provides them (they are optional in the interface). The handler does not apply defaults, unlike `GetSignInEvents` which defaults limit=50 and offset=0. Inconsistent pagination defaults across query handlers. |
| 14 | Low      | Consistency    | `registration.ts:143-176`                                | **DI does not inject memory cache into `GetSignInEvents`, `CheckSignInThrottle`, or `RecordSignInOutcome`.** These handlers accept optional cache parameters but the DI registration creates them without cache. This means the DI path always operates without caching. The factory functions (`createSignInEventHandlers`, `createSignInThrottleHandlers`) do accept cache. This is intentional (per assumption #11) but means DI-resolved handlers underperform vs. factory-resolved ones. |
| 15 | Low      | Maintainability| `index.ts:69-70` + `index.ts:87-89`                     | **Duplicate type exports.** `RecordSignInEventInput`/`Output` are exported both from the handler re-export block (line 69-71) and also exist as repo interface types with the same name from `interfaces/repository/handlers/index.js` (line 30-31). These are different types (app-level vs. repo-level) but share the name `RecordSignInEventInput`. The barrel disambiguates them, but could confuse consumers. |

---

**Cross-service comparison with `@d2/comms-app`**:

| Aspect                      | Auth App                                                      | Comms App                                                    | Assessment     |
|-----------------------------|---------------------------------------------------------------|--------------------------------------------------------------|----------------|
| Handler pattern             | BaseHandler + Zod + D2Result (9 of 13 handlers use Zod)      | BaseHandler + Zod + D2Result (1 of 4 handlers use Zod)       | Both have gaps |
| TLC folder convention       | `c/`, `q/` directories                                        | `c/`, `q/`, `x/` directories                                 | Consistent     |
| Service keys                | Separate `service-keys.ts`, infra + app keys                  | Separate `service-keys.ts`, infra + app keys                  | Consistent     |
| Registration                | `addAuthApp(services, options)`                                | `addCommsApp(services)`                                       | Auth needs callback; justified |
| Factory functions           | 5 legacy factory functions exported                            | 1 factory function (`createDeliveryHandlers`)                 | Auth has more legacy surface |
| Repo interface bundles      | 3 bundles (SignInEvent, EmulationConsent, OrgContact)          | 4 bundles (Message, Request, Attempt, ChannelPref)            | Consistent pattern |
| Health check                | DB + Cache + optional Messaging                                | DB + optional Messaging (no cache)                            | **Inconsistency** |
| Barrel exports              | All types + implementations + factories + DI                   | All types + implementations + factories + DI                   | Consistent     |
| Error handling on repo fail | Silent fallback to empty (queries), bubbleFail (commands)      | bubbleFail on all paths                                        | **Auth queries swallow errors** |
| IDOR prevention             | `organizationId` check on update/delete                        | N/A (comms operates on contactId, no org-scoped IDOR)          | Auth properly guards |

---

**Tests to add**:

- [ ] `GetSignInEvents` -- cache behavior for offset > 0 (validate the staleness bug: cache never serves non-first pages)
- [ ] `GetSignInEvents` -- Zod validation rejection for non-UUID userId
- [ ] `RecordSignInOutcome` -- input with missing/malformed `identifierHash` (tests may exist; verify coverage of edge cases)
- [ ] `CheckSignInThrottle` -- input with empty strings for hashes
- [ ] `CreateUserContact` -- empty `name` string should be rejected (once schema is fixed)
- [ ] `GetActiveConsents` -- repo failure returns empty array (document this as intentional behavior or fix)
- [ ] `GetOrgContacts` -- repo failure returns empty array (same as above)
- [ ] `GetOrgContacts` -- verify pagination defaults are applied (currently no defaults like GetSignInEvents)
- [ ] `CheckHealth` -- unit tests (currently no test file exists for this handler)
- [ ] `UpdateOrgContactHandler` -- metadata-only update when `contact` field is not provided (verify no Geo call is made)
- [ ] `CreateOrgContact` -- rollback path when `geoResult.data.data[0]` is undefined but `geoResult.success` is true (line 130-138)

**Tests to remove**: None -- all 12 existing test files correspond to implemented handlers and are appropriate.
