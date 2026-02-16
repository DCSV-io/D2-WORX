# @d2/auth-domain

Pure domain types for the D2-WORX Auth service. Zero infrastructure dependencies — only depends on `@d2/utilities` for string cleaning, email validation, and UUIDv7 generation.

## Purpose

Defines the public contract for all auth data leaving the service. These types are consumed by:

- `@d2/auth-client` (BFF for SvelteKit)
- `@d2/auth-sdk` (backend gRPC client)
- Auth service internals (app layer, infra layer)

## Design Decisions

| Decision                          | Rationale                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Readonly interfaces + factories   | More idiomatic TS than classes. Better tree-shaking, consistent functional style |
| Immutable-by-default              | "Mutation" returns new objects via spread+override                               |
| String literal unions (not enums) | `as const` arrays + derived types. No TS `enum` keyword                          |
| No navigation properties          | Children loaded separately, composed at app layer (matches .NET Geo pattern)     |
| BetterAuth entities = type-only   | Account/Session have interfaces but no factories (creation managed by infra)     |
| Password excluded from Account    | Infra detail that must never leave auth-infra                                    |

## Package Structure

```
src/
  index.ts                  Barrel exports
  constants/
    auth-constants.ts       JWT_CLAIM_TYPES, SESSION_FIELDS, AUTH_POLICIES, REQUEST_HEADERS, PASSWORD_POLICY, SIGN_IN_THROTTLE
  enums/
    org-type.ts             OrgType: admin | support | customer | third_party | affiliate
    role.ts                 Role: owner | officer | agent | auditor (+ ROLE_HIERARCHY)
    invitation-status.ts    InvitationStatus: pending | accepted | rejected | canceled | expired
  exceptions/
    auth-domain-error.ts    Base error (extends Error)
    auth-validation-error.ts  Structured validation error (entityName, propertyName, invalidValue, reason)
  entities/
    account.ts              Account interface (BetterAuth-managed, type-only)
    session.ts              Session interface (BetterAuth-managed, type-only, includes custom extension fields)
    user.ts                 User interface + createUser + updateUser
    organization.ts         Organization interface + createOrganization + updateOrganization
    member.ts               Member interface + createMember
    invitation.ts           Invitation interface + createInvitation
    sign-in-event.ts        SignInEvent interface + createSignInEvent
    emulation-consent.ts    EmulationConsent interface + create + revoke + isConsentActive
    org-contact.ts          OrgContact interface + createOrgContact + updateOrgContact
  value-objects/
    session-context.ts      SessionContext interface (computed, not persisted)
  rules/
    emulation.ts            resolveSessionContext, canEmulate
    membership.ts           isLastOwner, isMemberOfOrg
    org-creation.ts         canCreateOrgType
    invitation.ts           transitionInvitationStatus, isInvitationExpired
    sign-in-throttle-rules.ts  computeSignInDelay (pure: failure count → delay ms)
```

## Enums

All "enums" are `as const` arrays with derived union types and type guard functions.

| Enum             | Values                                           | Extras                                    |
| ---------------- | ------------------------------------------------ | ----------------------------------------- |
| OrgType          | admin, support, customer, third_party, affiliate | `isValidOrgType` guard                    |
| Role             | owner, officer, agent, auditor                   | `ROLE_HIERARCHY` map, `isValidRole` guard |
| InvitationStatus | pending, accepted, rejected, canceled, expired   | `INVITATION_TRANSITIONS` state machine    |

## Entities

| Entity           | Factory         | Update          | Key Rules                                              |
| ---------------- | --------------- | --------------- | ------------------------------------------------------ |
| Account          | —               | —               | BetterAuth-managed. Password excluded                  |
| Session          | —               | —               | BetterAuth-managed. 4 custom extension fields          |
| User             | `createUser`    | `updateUser`    | Email cleaned+validated, name required, UUIDv7 ID      |
| Organization     | `createOrg...`  | `updateOrg...`  | Slug lowercased, slug+orgType immutable after creation |
| Member           | `createMember`  | —               | Valid role required, BetterAuth manages role changes   |
| Invitation       | `createInv...`  | —               | Status via rules/, always starts as "pending"          |
| SignInEvent      | `createSign...` | —               | Immutable audit record                                 |
| EmulationConsent | `createEmu...`  | `revokeEmu...`  | Future expiresAt required, `isConsentActive` helper    |
| OrgContact       | `createOrgC...` | `updateOrgC...` | Junction to Geo Contact, label required                |

## Business Rules

| Rule                       | Function                                                                   |
| -------------------------- | -------------------------------------------------------------------------- |
| Emulation resolution       | `resolveSessionContext(session)` — emulated → auditor role                 |
| Emulation eligibility      | `canEmulate(orgType)` — only support + admin                               |
| Last owner protection      | `isLastOwner(members, userId)` — prevents orphaned orgs                    |
| Membership check           | `isMemberOfOrg(members, userId, orgId)`                                    |
| Org creation authorization | `canCreateOrgType(target, creatorOrgType)` — per-type rules                |
| Invitation state machine   | `transitionInvitationStatus(inv, newStatus)` — validates transitions       |
| Invitation expiry          | `isInvitationExpired(inv)` — checks expiresAt vs now                       |
| Sign-in throttle delay     | `computeSignInDelay(failureCount)` — 3 free, then 5s→15s→30s→1m→5m→15m max |

## Constants

### SIGN_IN_THROTTLE

Progressive brute-force delay constants used by `computeSignInDelay` and the app-layer throttle handlers.

| Constant                  | Value               | Purpose                                       |
| ------------------------- | ------------------- | --------------------------------------------- |
| `FREE_ATTEMPTS`           | 3                   | Attempts before throttling begins             |
| `MAX_DELAY_MS`            | 900,000 (15 min)    | Maximum delay cap                             |
| `ATTEMPT_WINDOW_SECONDS`  | 900 (15 min)        | TTL for failure counter                       |
| `KNOWN_GOOD_TTL_SECONDS`  | 7,776,000 (90 days) | TTL for known-good identity flag              |
| `KNOWN_GOOD_CACHE_TTL_MS` | 300,000 (5 min)     | Local memory cache TTL for known-good lookups |

Redis key prefixes (`signin:known:`, `signin:attempts:`, `signin:locked:`) are infra concerns — defined in `SignInThrottleStore`, not in domain.

## Tests

All tests are in `@d2/auth-tests` (`backends/node/services/auth/tests/`):

```
src/unit/domain/
  enums/          org-type.test.ts, role.test.ts, invitation-status.test.ts
  exceptions/     auth-domain-error.test.ts, auth-validation-error.test.ts
  entities/       user.test.ts, organization.test.ts, member.test.ts, invitation.test.ts,
                  sign-in-event.test.ts, emulation-consent.test.ts, org-contact.test.ts
  rules/          emulation.test.ts, membership.test.ts, org-creation.test.ts, invitation.test.ts,
                  sign-in-throttle-rules.test.ts
```

Run: `pnpm vitest run --project auth-tests`
