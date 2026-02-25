### Module 16: Auth Domain

**Package**: `@d2/auth-domain` (`backends/node/services/auth/domain/`)
**Files reviewed**: 27 source files (10,294 total lines; 1,068 logic lines excluding data files)

**Source files**:

| File                                     | Lines | Purpose                                         |
| ---------------------------------------- | ----- | ----------------------------------------------- |
| `src/index.ts`                           | 79    | Barrel exports                                  |
| `src/constants/auth-constants.ts`        | 105   | JWT_CLAIM_TYPES, SESSION_FIELDS, etc.           |
| `src/enums/org-type.ts`                  | 14    | OrgType union + guard                           |
| `src/enums/role.ts`                      | 25    | Role union + hierarchy + guard                  |
| `src/enums/invitation-status.ts`         | 35    | Status union + state machine transitions        |
| `src/exceptions/auth-domain-error.ts`    | 9     | Base domain error                               |
| `src/exceptions/auth-validation-error.ts`| 23    | Structured validation error                     |
| `src/entities/account.ts`                | 14    | Account interface (type-only, no factory)        |
| `src/entities/session.ts`                | 26    | Session interface (type-only, no factory)        |
| `src/entities/user.ts`                   | 88    | User interface + createUser + updateUser         |
| `src/entities/organization.ts`           | 87    | Organization + createOrganization + update       |
| `src/entities/member.ts`                 | 41    | Member + createMember                            |
| `src/entities/invitation.ts`             | 75    | Invitation + createInvitation                    |
| `src/entities/sign-in-event.ts`          | 45    | SignInEvent + createSignInEvent                  |
| `src/entities/emulation-consent.ts`      | 71    | EmulationConsent + create + revoke + isActive    |
| `src/entities/org-contact.ts`            | 74    | OrgContact + create + update                     |
| `src/value-objects/session-context.ts`   | 16    | SessionContext interface                         |
| `src/rules/emulation.ts`                 | 39    | resolveSessionContext, canEmulate                 |
| `src/rules/invitation.ts`               | 35    | transitionInvitationStatus, isInvitationExpired  |
| `src/rules/membership.ts`               | 21    | isLastOwner, isMemberOfOrg                       |
| `src/rules/org-creation.ts`             | 26    | canCreateOrgType                                 |
| `src/rules/password-rules.ts`           | 49    | validatePassword (sync, no network)              |
| `src/rules/sign-in-throttle-rules.ts`   | 42    | computeSignInDelay (pure)                        |
| `src/rules/username-rules.ts`           | 30    | generateUsername (crypto.randomInt)               |
| `src/data/common-passwords.ts`          | 1,027 | 1,000 base64-encoded common passwords            |
| `src/data/username-adjectives.ts`       | 4,099 | 4,096 PascalCase adjectives                      |
| `src/data/username-nouns.ts`            | 4,099 | 4,096 PascalCase nouns                           |

---

**Assumptions documented**:

1. **BetterAuth manages Account and Session lifecycle** -- These entities are type-only interfaces with no factory functions. Domain never creates or mutates them directly; it only provides the read contract.
2. **Password field is excluded from Account** -- Treated as an infra-only concern that must never leave auth-infra. The `Account` interface deliberately omits it.
3. **`cleanAndValidateEmail` throws plain `Error`, not `AuthValidationError`** -- This is a `@d2/utilities` function that predates the auth domain error hierarchy. Callers in entity factories (user.ts, invitation.ts) propagate the raw `Error` from utilities. This is consistent because the email validation is a shared utility, not an auth-domain-specific concern.
4. **`cleanStr` returns `undefined` (not `null`) for empty input** -- Entity factories that use `cleanStr` check for truthiness (`if (!slug)`) which covers both `undefined` and `""`. This is correct.
5. **`atob` is globally available** -- The `declare function atob` in common-passwords.ts is a TypeScript ambient declaration for an API that has been global in Node.js since v16. The file also has `"types": ["node"]` in tsconfig, which includes `atob` globally. The explicit `declare` is redundant but harmless.
6. **Username arrays are exactly 4,096 entries** -- Matches `USERNAME_RULES.ADJECTIVE_COUNT` and `NOUN_COUNT` constants. The combinatorial space is 4,096 x 4,096 x 999 = ~16.76 billion unique usernames.
7. **Common passwords are all 12+ characters** -- File comment states this; shorter passwords are rejected by BetterAuth's native `minPasswordLength: 12` before the custom hash hook runs.
8. **Organization slug and orgType are immutable after creation** -- `updateOrganization` only accepts `name`, `logo`, and `metadata` in `UpdateOrganizationInput`. Slug and orgType are excluded by design.
9. **Member role changes are BetterAuth-managed** -- `createMember` is the only factory function; there is no `updateMember`. BetterAuth's org plugin handles role changes directly.
10. **Invitation always starts as "pending"** -- `createInvitation` hardcodes `status: "pending"`. All status changes go through `transitionInvitationStatus` which enforces the state machine.
11. **Emulation forces auditor role** -- `resolveSessionContext` always returns `effectiveRole: "auditor"` when emulating, regardless of the user's actual role.
12. **`Date.now()` is used directly for time comparisons** -- No injectable clock abstraction. Tests that involve time-based logic (invitation expiry, consent expiry) must set up dates relative to `Date.now()` or mock `Date`.
13. **JWT claim types must match exactly across Node.js and .NET** -- Verified: all 17 claim names in `JWT_CLAIM_TYPES` match the .NET `JwtClaimTypes` class character-for-character.
14. **AUTH_POLICIES must match across Node.js and .NET** -- Verified: all 4 policy names match the .NET `AuthPolicies` class.
15. **REQUEST_HEADERS must match across Node.js and .NET** -- Verified: both headers match the .NET `RequestHeaders` class.

---

**Findings**:

| #  | Severity | Category        | File:Line                            | Description                                                                                                                                                                                                                                                                                                                                                                              |
| -- | -------- | --------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Medium   | Consistency     | `entities/user.ts:43-48`             | **Username/displayUsername not cleaned in `createUser`**. Unlike `name` (which goes through `cleanStr`) and `email` (which goes through `cleanAndValidateEmail`), the `username` and `displayUsername` fields are only checked for truthiness but not cleaned (trimmed, whitespace-collapsed). If a caller passes `"  FooBar  "`, it would be stored with leading/trailing spaces. The `generateUsername` function in `username-rules.ts` always produces clean output, but `createUser` accepts arbitrary string input for these fields. Consider adding `cleanStr` for consistency, or document that callers are responsible for pre-cleaning. |
| 2  | Medium   | Consistency     | `entities/user.ts:82-83`             | **`updateUser` does not validate username/displayUsername emptiness**. If `updates.username` is provided as `""` (empty string), the `??` operator will NOT fall back to `user.username` because `""` is not nullish -- it will set username to an empty string. This differs from how `name` is handled (where `cleanStr` converts `""` to `undefined` and triggers a validation error). Same issue applies to `displayUsername`. |
| 3  | Low      | Consistency     | `entities/user.ts:82-83`             | **`updateUser` uses `??` for username/displayUsername but `!== undefined` for image**. The `image` field correctly uses `updates.image !== undefined ? updates.image : user.image` to distinguish between "not updating" and "setting to null". The `username`/`displayUsername` fields use `??` which means passing `null` explicitly would incorrectly fall through to the existing value. This is unlikely to matter in practice since these fields are typed as `string`, not `string | null`, but the inconsistency is worth noting for pattern uniformity. |
| 4  | Low      | Elegance        | `data/common-passwords.ts:1023`      | **Redundant `declare function atob` ambient declaration**. Node.js 16+ provides `atob` globally, and the tsconfig includes `"types": ["node"]` which already declares it. This ambient declaration is unnecessary. While harmless, removing it would reduce confusion about whether this is a polyfill concern. |
| 5  | Low      | Maintainability | `constants/auth-constants.ts:78-84`  | **Misplaced JSDoc comment**. The `SIGN_IN_THROTTLE` block has a dangling JSDoc comment at lines 72-77 that appears to be a leftover from the `PASSWORD_POLICY` constant (which already has its own JSDoc). The comment about "Progressive delay per (identifier, identity) pair" is stranded between the `GEO_CONTEXT_KEYS` declaration and the `SIGN_IN_THROTTLE` declaration. The JSDoc for `GEO_CONTEXT_KEYS` at lines 79-84 is correctly placed, but the orphaned JSDoc at lines 72-77 should either be removed or moved directly above `SIGN_IN_THROTTLE`. |
| 6  | Low      | Consistency     | `entities/org-contact.ts:71`         | **`updateOrgContact` uses `??` for `isPrimary`**. Since `isPrimary` is a boolean, using `updates.isPrimary ?? orgContact.isPrimary` means explicitly passing `false` works correctly (falsy but not nullish). However, it cannot distinguish between "did not provide isPrimary" (`undefined`) and "explicitly set to null" (`null`). The input type has `isPrimary?: boolean` so `null` is not a valid value -- this is actually fine. Noting for completeness only; no change needed. |
| 7  | Low      | Consistency     | Cross-service                        | **Auth domain uses exceptions for validation; comms domain uses identical pattern**. Both `AuthValidationError` and `CommsValidationError` have identical structure (entityName, propertyName, invalidValue, reason) and identical message formatting. This is excellent consistency. Both extend their respective base domain errors. No issue -- this is a positive finding. |
| 8  | Low      | Consistency     | Cross-service                        | **Auth constants file is a flat object export; comms constants are also flat object exports**. Both follow the same `export const X = { ... } as const` pattern. Auth has 6 constant groups (JWT_CLAIM_TYPES, SESSION_FIELDS, AUTH_POLICIES, REQUEST_HEADERS, PASSWORD_POLICY, GEO_CONTEXT_KEYS, SIGN_IN_THROTTLE = 7 actually), comms has 6 (RETRY_POLICY, DELIVERY_DEFAULTS, CHANNEL_DEFAULTS, COMMS_MESSAGING, COMMS_RETRY, THREAD_CONSTRAINTS). Consistent pattern. |
| 9  | Low      | Elegance        | `rules/emulation.ts:12`              | **`resolveSessionContext` checks `!== null` for emulatedOrganizationId**. This is correct and defensive. A minor note: since Session's `emulatedOrganizationId` is typed as `string | null`, this is precisely the right check. No change needed. |
| 10 | Low      | Elegance        | `rules/org-creation.ts:12-26`        | **`canCreateOrgType` uses exhaustive switch without default**. TypeScript's control flow analysis ensures all `OrgType` values are handled, and the function's return type is inferred as `boolean`. The exhaustiveness means adding a new `OrgType` value would cause a compile error (function wouldn't return on the new branch). This is good -- intentional exhaustive pattern. |
| 11 | Low      | Elegance        | `entities/invitation.ts:56`          | **Invitation `expiresAt` uses `Date.now()` directly for "must be in the future" check**. This makes the factory non-deterministic relative to test execution time. However, since this is a domain guard (not a timer), the approach is standard and tests can simply create dates sufficiently far in the future. Same pattern used in `emulation-consent.ts:43`. No issue. |

---

**Summary Assessment**:

The auth-domain package is **exceptionally well-structured**. Key strengths:

1. **Zero infrastructure dependencies** -- only depends on `@d2/utilities` for string/email/UUID helpers.
2. **Perfect cross-service consistency** -- The exception hierarchy, enum pattern (`as const` arrays + type guards), entity pattern (readonly interfaces + factory functions + immutable updates), and barrel export structure exactly mirror `@d2/comms-domain`.
3. **Perfect cross-platform consistency** -- All 17 JWT claim types, 4 auth policies, and 2 request headers match their .NET counterparts character-for-character.
4. **Clean domain boundary** -- Account and Session are type-only (no factory), enforcing that BetterAuth owns their lifecycle. Password is excluded from the Account interface.
5. **Comprehensive business rules** -- Emulation resolution, invitation state machine, org creation authorization, sign-in throttle delay curve, and last-owner protection are all pure functions with no side effects.
6. **Strong security posture** -- 1,000 common passwords (base64-encoded to keep plaintext out of source), cryptographic random for usernames, progressive brute-force delays.
7. **Data file integrity** -- Adjective/noun arrays have exactly 4,096 entries each, matching the declared constants. Common passwords count matches documentation (1,000 entries, all 12+ chars).

The only findings with any substantive impact are #1 and #2 (username cleaning gap in `createUser` and empty-string passthrough in `updateUser`). These are medium severity because they could theoretically allow untrimmed or empty usernames through the domain layer, though in practice the `generateUsername` function always produces clean output and BetterAuth's username plugin likely pre-validates.

---

**Tests to add**:
- [ ] `createUser` with whitespace-padded username/displayUsername (e.g., `"  FooBar  "`) -- verify whether current behavior is intentional (passthrough) or should be cleaned
- [ ] `updateUser` with empty string `""` for username -- verify it does not silently set username to empty string
- [ ] `updateUser` with empty string `""` for displayUsername -- same as above
- [ ] `password-rules.ts`: test with password that is exactly 12 characters and matches a common password -- verify blocklist check works at boundary length
- [ ] `username-rules.ts`: verify `generateUsername` output format always matches expected `AdjectiveNoun###` pattern (no edge cases with short suffixes like `1` vs `001`)

**Tests to remove**: None. All 19 existing test files cover the appropriate domain files:
- 7 entity test files (user, organization, member, invitation, sign-in-event, emulation-consent, org-contact)
- 3 enum test files (org-type, role, invitation-status)
- 2 exception test files (auth-domain-error, auth-validation-error)
- 7 rule test files (emulation, membership, org-creation, invitation, password-rules, sign-in-throttle-rules, username-rules)
