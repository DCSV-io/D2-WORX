### Module 13: Comms App

**Files reviewed**: 27 source files + 7 test files + config/doc = 37 total

**Source files**:

- `handlers/x/deliver.ts` (314 lines) — main delivery pipeline
- `handlers/x/resolve-recipient.ts` (72 lines)
- `handlers/c/set-channel-preference.ts` (83 lines)
- `handlers/q/get-channel-preference.ts` (67 lines)
- `handlers/q/check-health.ts` (80 lines)
- `service-keys.ts` (104 lines)
- `registration.ts` (121 lines)
- `index.ts` (187 lines)
- `interfaces/repository/handlers/index.ts` (123 lines)
- 12x `interfaces/repository/handlers/{c,r,u}/*.ts` (~166 total)
- `interfaces/providers/email/email-provider.ts` (15 lines)
- `interfaces/providers/sms/sms-provider.ts` (12 lines)
- Various barrel files

**Test files** (~1,358 lines):

- `deliver.test.ts` (406), `resolve-recipient.test.ts` (127)
- `set-channel-preference.test.ts` (186), `get-channel-preference.test.ts` (184)
- `mock-handlers.ts` (97), `factories.test.ts` (34)
- `deliver-handler.test.ts` integration (324)

---

**Assumptions documented**:

1. Domain factory functions (`createMessage`, `createDeliveryRequest`, `createDeliveryAttempt`) throw exceptions on invalid input — not caught by handler, rely on BaseHandler's outer try/catch.
2. RecipientResolver assumes single contact per contactId, picks first email and first phone from contact methods arrays. Ordering determined by Geo service.
3. `marked.parse()` with `{ async: false }` is synchronous and returns string (correct for marked 17.x, `as string` cast fragile for upgrades).
4. Channel preferences default to email+sms enabled when no record exists (null prefs).
5. `renderTemplate` assumes only `{{word}}` placeholders. Matching patterns in email content incorrectly stripped to empty strings.
6. SMS dispatch path silently leaves attempt in "pending" when `smsProvider` undefined.
7. DI registration doesn't pass cache handlers to preference handlers — DI-resolved instances never cache.
8. CheckHealth always returns `D2Result.ok` (degraded = successful result with unhealthy component data).
9. `dist/` contains stale artifacts from previous architecture.

---

**Findings**:

| #   | Severity | Category        | File:Line                           | Description                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------- | --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **High** | Bug             | `deliver.ts:148`                    | **RecipientResolver success with empty data treated as 503 — but 503 path is dead code.** RecipientResolver NEVER returns a failure — it always returns `D2Result.ok({ data: {} })`. This makes the 503 check at lines 148-153 unreachable. Handler cannot distinguish "geo down" from "contact has no methods". Both result in 404. If geo is down, 404 is misleading; should be 503.                 |
| 2   | **High** | Bug             | `deliver.ts:229`                    | **SMS attempt stuck in "pending" when smsProvider undefined.** When `smsProvider` not configured, neither email nor SMS dispatch block executes for SMS channel. Attempt created in "pending", persisted to DB, never resolved. `allTerminal` check is false (pending not terminal), so `markProcessed` never called. Handler still returns success. Creates orphaned pending attempts.                |
| 3   | **High** | Security        | `deliver.ts:99`                     | **No Zod input validation on Deliver handler.** Primary entry point accepting external-originated data (correlationId, recipientContactId, title, content, metadata). No `validateInput()` call. Domain factories validate some fields via exceptions (not D2Result). `correlationId` and `recipientContactId` have no UUID format validation. Violates CLAUDE.md: "All handlers MUST validate input." |
| 4   | Medium   | Security        | `resolve-recipient.ts:32`           | **No Zod input validation on RecipientResolver.** Uses manual falsy check instead of Zod. No UUID format enforcement on contactId.                                                                                                                                                                                                                                                                     |
| 5   | Medium   | Security        | `deliver.ts:200`                    | **Title unescaped in HTML email template.** DOMPurify sanitizes body content, but `input.title` interpolated via `renderTemplate` without HTML entity escaping. Title with `<script>` renders as-is in email.                                                                                                                                                                                          |
| 6   | Medium   | Consistency     | `registration.ts:83-110`            | **DI registration omits in-memory cache for channel preference handlers.** Runtime path via comms-api never benefits from caching, while factory-created instances (tests) can.                                                                                                                                                                                                                        |
| 7   | Medium   | Consistency     | `deliver.ts:157-164`                | **Deliver bypasses GetChannelPreference handler, reads prefs directly from repo.** Misses cache-aside logic. Always hits DB. Maintenance risk if preference lookup changes.                                                                                                                                                                                                                            |
| 8   | Medium   | Maintainability | `deliver.ts:186-266`                | **Sequential channel dispatch.** Email + SMS dispatch sequential (`for...of` with `await`). Could be concurrent with `Promise.all`.                                                                                                                                                                                                                                                                    |
| 9   | Low      | Consistency     | `deliver.ts:198-248`                | **Duplicated error handling between email and SMS dispatch blocks.** Retry computation logic repeated identically. Extract shared helper.                                                                                                                                                                                                                                                              |
| 10  | Low      | Consistency     | `deliver.ts:252-263`                | **Attempt created then immediately updated in separate DB calls.** Create persists "pending", update changes to "sent"/"failed". Extra round-trip.                                                                                                                                                                                                                                                     |
| 11  | Low      | Maintainability | `deliver.ts:303-304`                | **renderTemplate silently strips unmatched `{{word}}` patterns.** Any literal `{{...}}` in email content stripped to empty string.                                                                                                                                                                                                                                                                     |
| 12  | Low      | Consistency     | `service-keys.ts` vs `COMMS_APP.md` | **Documentation says "16 infra + 4 app" but actual is 15 infra + 5 app.** Total 20 correct.                                                                                                                                                                                                                                                                                                            |
| 13  | Low      | Maintainability | `dist/` directory                   | **Stale dist/ artifacts from old architecture** (~15 removed files still in dist/).                                                                                                                                                                                                                                                                                                                    |
| 14  | Low      | Elegance        | `resolve-recipient.ts:44-47`        | **Unnecessary array construction from single map lookup.** Could check `if (!contact)` directly.                                                                                                                                                                                                                                                                                                       |
| 15  | Low      | Consistency     | `check-health.ts:50`                | **Checks `dbResult.data` but not `dbResult.success`.** Could mask ping failure with non-null data. Same pattern in auth CheckHealth.                                                                                                                                                                                                                                                                   |
| 16  | Low      | Consistency     | `get-channel-preference.ts:41`      | **Manual falsy check instead of Zod validation.** Returns null for invalid contactId instead of validation error. Asymmetric with SetChannelPreference.                                                                                                                                                                                                                                                |

---

**Tests to add**:

- [ ] CheckHealth handler — no tests exist. Cover: both healthy, DB unhealthy, messaging unhealthy, both unhealthy
- [ ] Deliver with SMS provider present but send fails — verify retry scheduling
- [ ] Deliver when `createMessage` throws domain validation error — verify BaseHandler catches → D2Result
- [ ] `renderTemplate` when title contains HTML characters (XSS in email subject)
- [ ] Deliver when `attemptRepo.create` fails — verify graceful handling
- [ ] SMS "pending" orphan scenario — smsProvider undefined + only SMS channel deliverable
- [ ] Integration test for channel preference caching round-trip

**Tests to remove**: None — all existing tests are relevant.
