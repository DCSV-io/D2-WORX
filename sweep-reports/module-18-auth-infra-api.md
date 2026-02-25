### Module 18: Auth Infra + API

**Files reviewed**: 56 source files (39 infra + 17 API)

**Source files**:

Auth Infra (`@d2/auth-infra`):
| File | Lines |
|------|-------|
| `infra/src/index.ts` | 100 |
| `infra/src/registration.ts` | 112 |
| `infra/src/service-keys.ts` | 21 |
| `infra/src/auth/better-auth/auth-config.ts` | 71 |
| `infra/src/auth/better-auth/auth-factory.ts` | 401 |
| `infra/src/auth/better-auth/access-control.ts` | 49 |
| `infra/src/auth/better-auth/secondary-storage.ts` | 37 |
| `infra/src/auth/better-auth/hooks/id-hooks.ts` | 12 |
| `infra/src/auth/better-auth/hooks/org-hooks.ts` | 20 |
| `infra/src/auth/better-auth/hooks/username-hooks.ts` | 32 |
| `infra/src/auth/better-auth/hooks/password-hooks.ts` | 117 |
| `infra/src/auth/sign-in-throttle-store.ts` | 82 |
| `infra/src/mappers/user-mapper.ts` | 30 |
| `infra/src/mappers/org-mapper.ts` | 29 |
| `infra/src/mappers/session-mapper.ts` | 44 |
| `infra/src/mappers/member-mapper.ts` | 23 |
| `infra/src/mappers/invitation-mapper.ts` | 26 |
| `infra/src/repository/schema/better-auth-tables.ts` | 171 |
| `infra/src/repository/schema/custom-tables.ts` | 64 |
| `infra/src/repository/schema/index.ts` | 23 |
| `infra/src/repository/schema/types.ts` | 11 |
| `infra/src/repository/utils/pg-errors.ts` | 7 |
| `infra/src/repository/migrate.ts` | 22 |
| `infra/src/repository/handlers/factories.ts` | 60 |
| `infra/src/repository/handlers/q/ping-db.ts` | 28 |
| `infra/src/repository/handlers/c/create-sign-in-event.ts` | 33 |
| `infra/src/repository/handlers/c/create-emulation-consent-record.ts` | 47 |
| `infra/src/repository/handlers/c/create-org-contact-record.ts` | 47 |
| `infra/src/repository/handlers/r/find-sign-in-events-by-user-id.ts` | 48 |
| `infra/src/repository/handlers/r/count-sign-in-events-by-user-id.ts` | 32 |
| `infra/src/repository/handlers/r/get-latest-sign-in-event-date.ts` | 37 |
| `infra/src/repository/handlers/r/find-emulation-consent-by-id.ts` | 48 |
| `infra/src/repository/handlers/r/find-active-consents-by-user-id.ts` | 54 |
| `infra/src/repository/handlers/r/find-active-consent-by-user-id-and-org.ts` | 53 |
| `infra/src/repository/handlers/r/find-org-contact-by-id.ts` | 42 |
| `infra/src/repository/handlers/r/find-org-contacts-by-org-id.ts` | 51 |
| `infra/src/repository/handlers/u/revoke-emulation-consent-record.ts` | 32 |
| `infra/src/repository/handlers/u/update-org-contact-record.ts` | 36 |
| `infra/src/repository/handlers/d/delete-org-contact-record.ts` | 29 |

Auth API (`@d2/auth-api`):
| File | Lines |
|------|-------|
| `api/src/index.ts` | 36 |
| `api/src/main.ts` | 116 |
| `api/src/composition-root.ts` | 453 |
| `api/src/middleware/authorization.ts` | 109 |
| `api/src/middleware/cors.ts` | 16 |
| `api/src/middleware/csrf.ts` | 65 |
| `api/src/middleware/distributed-rate-limit.ts` | 40 |
| `api/src/middleware/error-handler.ts` | 61 |
| `api/src/middleware/request-enrichment.ts` | 28 |
| `api/src/middleware/session.ts` | 52 |
| `api/src/middleware/session-fingerprint.ts` | 135 |
| `api/src/middleware/scope.ts` | 113 |
| `api/src/routes/auth-routes.ts` | 133 |
| `api/src/routes/emulation-routes.ts` | 92 |
| `api/src/routes/org-contact-routes.ts` | 98 |
| `api/src/routes/invitation-routes.ts` | 164 |
| `api/src/routes/health.ts` | 52 |

---

**Assumptions documented**:

1. BetterAuth is the ONLY auth library and is treated as pure infrastructure -- its types never escape `auth-infra`. All data crosses the boundary as domain types.
2. The Drizzle schema in `better-auth-tables.ts` is manually maintained to match BetterAuth's internal schema. If BetterAuth adds/removes/renames columns in an upgrade, this schema must be manually updated.
3. BetterAuth's `casing: "snake_case"` behavior is NOT explicitly configured in `createAuth()` -- the code instead handles both `camelCase` and `snake_case` field names in every mapper using fallback reads (`raw["fieldName"] ?? raw["field_name"]`).
4. The `organization` table in BetterAuth's schema does NOT have an `updatedAt` column, yet the `org-mapper.ts` reads one. If BetterAuth doesn't supply it, `toDomainOrganization` will silently produce `new Date()` (today's date) for `updatedAt`.
5. Custom tables use `withTimezone: true` on timestamps, but BetterAuth-managed tables use plain `timestamp()` (no timezone). This is assumed intentional since BetterAuth manages its own DDL.
6. The `org_contact` table does NOT have a `contact_id` column referencing Geo contacts. The relationship is implied by having the `org_contact.id` used as the `relatedEntityId` in Geo `ext_key` lookups. This design is documented in MEMORY.md.
7. `parsePostgresUrl` and `parseRedisUrl` are duplicated between auth `main.ts` and comms `main.ts` -- both are assumed to remain in-service entry points (not extracted to shared).
8. The HIBP breach check in `password-hooks.ts` uses `node:crypto` SHA-1 for k-anonymity. This is intentional -- SHA-1 is the HIBP API's required format, not used for security.
9. The fingerprint middleware fails open on Redis errors (cannot read stored fingerprint) -- this is explicitly documented as matching the rate limiter fail-open policy.
10. Session fingerprint middleware runs on BOTH auth routes and protected routes (applied twice in the pipeline), but with different semantics: on auth routes it binds/validates before BetterAuth handles the request; on protected routes it validates after session middleware extracts the user.
11. BetterAuth hooks use `Record<string, unknown>` casts extensively because BetterAuth's internal types are opaque/changing -- this is a deliberate tradeoff for decoupling.
12. The `createCallbackScope()` function in `composition-root.ts` creates temporary DI scopes with `isAuthenticated: false` for BetterAuth callbacks (onSignIn, publishVerificationEmail, etc.) because these fire in BetterAuth's internal context where no per-request scope exists.
13. The `geoClient` is cast to `undefined as never` when Geo is not configured -- callers will get a runtime error if they try to use it, which is the desired fail-fast behavior (documented via the warning log).

---

**Findings**:

| #  | Severity | Category        | File:Line | Description |
|----|----------|-----------------|-----------|-------------|
| 1  | High     | Bug             | `infra/src/repository/schema/better-auth-tables.ts:116-129` | The `organization` table definition is missing an `updatedAt` column. The domain `Organization` type has `updatedAt: Date` and `org-mapper.ts` reads `raw["updatedAt"] ?? raw["updated_at"]`. If BetterAuth includes this column in its actual DDL but it is missing from the Drizzle schema, Drizzle queries will not return it. The mapper will silently fall through to `new Date()`, producing incorrect timestamps. Verify whether BetterAuth's organization plugin creates an `updated_at` column and add it to the schema if so. |
| 2  | High     | Security        | `api/src/routes/invitation-routes.ts:33-38` | The invitation route validates that `email` and `role` are present, but does NOT validate that `role` is one of the allowed values (`owner`, `officer`, `agent`, `auditor`). An attacker could pass `role: "admin"` or any string. While BetterAuth's `createInvitation` may reject unknown roles, there is no explicit server-side Zod validation at the route level as required by the security checklist. The `firstName`, `lastName`, and `phone` fields also lack max-length validation. |
| 3  | High     | Security        | `api/src/routes/invitation-routes.ts:66-74` | When `auth.api.createInvitation` throws, the raw `err.message` is returned to the client: `const message = err instanceof Error ? err.message : "..."`. BetterAuth error messages may contain internal details (table names, constraint names, SQL fragments). This violates the error-handler principle of never leaking internal details for non-validation errors. Should return a generic message like "Failed to create invitation." |
| 4  | Medium   | Security        | `api/src/routes/emulation-routes.ts:34-41` | The `POST /api/emulation/consent` route reads `body.grantedToOrgId` and `body.expiresAt` directly from user input without Zod validation. No max-length on `grantedToOrgId`, no validation that `expiresAt` is a valid future date, no check that `grantedToOrgId` is a valid UUID format. The handler may validate, but the security checklist requires validation at the route level. |
| 5  | Medium   | Security        | `api/src/routes/org-contact-routes.ts:30-43` | The `POST /api/org-contacts` and `PATCH /api/org-contacts/:id` routes pass `body.label`, `body.isPrimary`, and `body.contact` directly without Zod validation at the route level. `label` should have a max-length check (the DB column is `varchar(100)`), and `isPrimary` should be validated as boolean. |
| 6  | Medium   | Consistency     | `api/src/main.ts:14-62` | `parsePostgresUrl()` and `parseRedisUrl()` are duplicated verbatim between `auth/api/src/main.ts` and `comms/api/src/main.ts`. These should be extracted to a shared utility (e.g., `@d2/utilities` or `@d2/service-defaults`) to avoid drift. The comms service only duplicates `parsePostgresUrl`; auth duplicates both. |
| 7  | Medium   | Consistency     | `infra/src/repository/schema/better-auth-tables.ts` | BetterAuth-managed tables use `timestamp("...")` without `withTimezone`, while custom tables use `timestamp("...", { withTimezone: true })`. If BetterAuth's actual DDL creates `timestamptz` columns but the Drizzle schema says `timestamp`, there could be timezone handling inconsistencies. This should be verified against BetterAuth's actual migration output. |
| 8  | Medium   | Maintainability | `infra/src/mappers/*.ts` | The `toDate()` helper function is duplicated identically in all 5 mapper files (user, org, session, member, invitation). Should be extracted to a shared `mappers/utils.ts` file. |
| 9  | Medium   | Maintainability | `infra/src/repository/handlers/r/*.ts` | The `toEmulationConsent()` mapping function is duplicated in 3 files (`find-emulation-consent-by-id.ts`, `find-active-consents-by-user-id.ts`, `find-active-consent-by-user-id-and-org.ts`). Similarly, `toOrgContact()` is duplicated in 2 files. These should be extracted to shared mapper utilities alongside the handler files. |
| 10 | Medium   | Consistency     | `api/src/routes/health.ts:14` | The health endpoint is mounted at `/health-rich` but AUTH_API.md documents it as `/health`. The comms service has no HTTP health endpoint (it uses gRPC). If the intent is to provide a basic health check at `/health` and a detailed one at `/health-rich`, only `/health-rich` exists. A simple `/health` returning `200 OK` with `{ status: "healthy" }` is missing. |
| 11 | Medium   | Bug             | `api/src/composition-root.ts:406-413` | The `bodyLimit` middleware returns HTTP 413 (Payload Too Large) but wraps it in a `D2Result.fail()` with `statusCode: HttpStatusCode.BadRequest` (400). The semantic mismatch means the JSON body says "400" but the HTTP response says "413". Should use `HttpStatusCode.PayloadTooLarge` or `413` for consistency. |
| 12 | Medium   | Bug             | `infra/src/repository/handlers/u/revoke-emulation-consent-record.ts:23-29` | The revoke handler executes `UPDATE ... SET revokedAt = new Date() WHERE id = input.id` but does not check if the update affected any rows. If the consent ID does not exist, it silently returns `D2Result.ok()`. Should check `result.rowCount` and return `D2Result.notFound()` if zero rows affected. The comms service's `MarkDeliveryRequestProcessed` handler has the same pattern, so this is consistent -- but still a logic gap. |
| 13 | Medium   | Bug             | `infra/src/repository/handlers/u/update-org-contact-record.ts:23-33` | Same as #12 -- the update handler does not verify that the target row exists. Returns success even if `input.contact.id` does not match any record. |
| 14 | Medium   | Bug             | `infra/src/repository/handlers/d/delete-org-contact-record.ts:23-27` | Same as #12 -- the delete handler does not verify that the target row exists. Returns success even if `input.id` does not match any record. The app-layer `DeleteOrgContact` handler does do a `findById` check first, so this is a defense-in-depth gap rather than a user-facing bug. |
| 15 | Medium   | Consistency     | `infra/src/service-keys.ts` vs `infra/src/index.ts` | `IPingDbKey` is NOT re-exported from `service-keys.ts` (which re-exports from `@d2/auth-app`), and is also NOT exported from `infra/src/index.ts`. The registration file imports `IPingDbKey` directly from `@d2/auth-app`. This is inconsistent with all other service keys being re-exported from `service-keys.ts` for composition root convenience. |
| 16 | Low      | Consistency     | `api/src/composition-root.ts:264-279` | The `createCallbackScope()` function duplicates the anonymous request context pattern that also appears in `createServiceScope()` in the comms composition root and in `health.ts:17-26`. This shared pattern (creating an unauthenticated scope with a random traceId) should ideally be a shared utility. |
| 17 | Low      | Elegance        | `api/src/routes/auth-routes.ts:67` | The `requestInfo` variable is read via `(c as any).get(REQUEST_INFO_KEY)` with an `eslint-disable` comment. This `any` cast exists because the Hono app type parameter doesn't include the `REQUEST_INFO_KEY` variable type. Could be solved by defining a shared Hono `Variables` type that includes `requestInfo`. |
| 18 | Low      | Consistency     | `api/src/routes/emulation-routes.ts:14-15` and `api/src/routes/org-contact-routes.ts:16-17` | `DEFAULT_LIMIT` (50) and `MAX_LIMIT` (100) constants are defined identically in both route files. Should be shared constants, perhaps from `@d2/auth-domain` or a local `constants.ts`. |
| 19 | Low      | Consistency     | `infra/src/repository/handlers/factories.ts` | The `factories.ts` file creates handler bundles (`createSignInEventRepoHandlers`, etc.) that appear to be unused -- `registration.ts` registers handlers individually via DI. The factories are exported from `index.ts` for potential test usage, but this is a code path divergence: DI uses individual handler registration, while factories create grouped instances. If factories are only for legacy test support, consider marking them as test-only exports or removing them. |
| 20 | Low      | Elegance        | `api/src/routes/invitation-routes.ts:84-85` | The `scope2` and `scope3` variables in the invitation route are really just re-reads of `c.get(SCOPE_KEY)`. The scope is the same throughout the request lifecycle -- these could all use the same `const scope = c.get(SCOPE_KEY)` at the top of the handler. |
| 21 | Low      | Maintainability | `api/src/middleware/session-fingerprint.ts:52-58` | Cookie parsing is hand-rolled (splitting on `;` and checking `startsWith`). While functional, it does not handle edge cases like cookie values containing `=` or URL-encoded values. Hono provides `getCookie()` from `hono/cookie` which would be more robust. However, since this runs before Hono's context is fully available (reading raw headers), the hand-rolled approach is reasonable. |
| 22 | Low      | Performance     | `infra/src/auth/better-auth/auth-factory.ts:244-272` | In `session.update.before`, two separate DB queries are executed sequentially (one for org type, one for member role). These could be parallelized with `Promise.all()` or combined into a single JOIN query for better performance on org switch. |
| 23 | Low      | Elegance        | `infra/src/auth/better-auth/auth-factory.ts:313-357` | The `definePayload` function executes a DB query to look up impersonator email/username on every JWT issuance where `impersonatedBy` is set. This is rare (impersonation is an admin action), so performance is not critical, but the query could be cached briefly (1-5 min) since impersonator details do not change. |
| 24 | Low      | Consistency     | `api/src/composition-root.ts:178-181` | The `geoClient` is assigned `undefined as never` when Geo is not configured. This same pattern appears in comms `composition-root.ts:122-123`. Both are consistent in their approach, which is good -- but the `as never` cast means TypeScript will not flag usage of an undefined client. A runtime guard before each geo operation would be safer. The existing warning log serves as the only guard. |

---

**Tests to add**:
- [ ] Unit test for `toDomainOrganization` mapper verifying behavior when `updatedAt` is missing from the raw record (validates the `new Date()` fallback behavior and whether this is actually correct)
- [ ] Unit test for invitation route with an invalid `role` value (e.g., `"admin"`, `"superuser"`, empty string) -- should return 400
- [ ] Unit test for invitation route ensuring `err.message` from BetterAuth is NOT leaked to the client
- [ ] Unit test for invitation route with `firstName`/`lastName`/`phone` exceeding reasonable max lengths
- [ ] Unit test for emulation consent route with invalid `grantedToOrgId` format (non-UUID), missing `expiresAt`, `expiresAt` in the past
- [ ] Unit test for org-contact route with `label` exceeding 100 characters (DB column limit)
- [ ] Unit test for `RevokeEmulationConsentRecord` repo handler when consent ID does not exist (should it return not-found?)
- [ ] Unit test for `UpdateOrgContactRecord` repo handler when contact ID does not exist
- [ ] Unit test for `DeleteOrgContactRecord` repo handler when contact ID does not exist
- [ ] Unit test verifying `bodyLimit` middleware returns consistent HTTP status code and D2Result statusCode (both should be 413)
- [ ] Integration test for the full session update hook (org switch) verifying that `activeOrganizationType` and `activeOrganizationRole` are correctly populated
- [ ] Unit test for `parsePostgresUrl` and `parseRedisUrl` with various edge cases (missing fields, already-URI format, special characters in password)
- [ ] Unit test for `extractIdentifier` in auth-routes with `null` body and unexpected path patterns
- [ ] Unit test for `computeFingerprint` with empty User-Agent and Accept headers

**Tests to remove**: None identified -- existing test coverage appears well-targeted.

---

**Cross-service consistency comparison (auth-infra/api vs comms-infra/api)**:

| Aspect | Auth | Comms | Consistent? |
|--------|------|-------|-------------|
| DI registration pattern | `addAuthInfra(services, db)` | `addCommsInfra(services, db)` | Yes |
| Handler lifetime | Transient (all repo handlers) | Transient (all repo handlers) | Yes |
| Service-level context | `new HandlerContext({...}, logger)` | `new HandlerContext({...}, logger)` | Yes |
| Scope creation | `createCallbackScope()` in comp root | `createServiceScope()` in comp root | Same pattern, different names |
| `parsePostgresUrl` | In `main.ts` | In `main.ts` | Duplicated (finding #6) |
| Migration pattern | `runMigrations(pool)` | `runMigrations(pool)` | Yes |
| Schema type exports | `types.ts` with `$inferSelect`/`$inferInsert` | `types.ts` with `$inferSelect`/`$inferInsert` | Yes |
| PG error handling | `isPgUniqueViolation` util | Not present (no unique constraints) | N/A |
| Health check | `PingDb` handler + `/health-rich` HTTP | `PingDb` handler + gRPC `checkHealth` | Different transport, same concept |
| Provider singleton pattern | `addInstance(key, new Handler(...))` for geo, cache | `addInstance(key, new Provider(...))` for email, SMS | Yes |
| Geo client guard | `config.geoAddress && config.geoApiKey` with `undefined as never` fallback | Same pattern | Yes |
| Factory exports | `createXxxRepoHandlers()` in `factories.ts` | `createXxxRepoHandlers()` in `factories.ts` | Yes |
| Index barrel | Comprehensive re-exports | Comprehensive re-exports | Yes |
| Service keys re-export | `service-keys.ts` re-exports from app | `service-keys.ts` re-exports from app | Yes |
