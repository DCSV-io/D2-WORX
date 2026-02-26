### Module 12: Comms Domain

**Files reviewed**: 25 source files + 23 test files + 3 config/doc = 51 total

**Source files** (in `comms/domain/`):

| File                                       | Lines |
| ------------------------------------------ | ----- |
| `src/index.ts`                             | 129   |
| `src/constants/comms-constants.ts`         | 63    |
| `src/enums/channel.ts`                     | 15    |
| `src/enums/delivery-status.ts`             | 32    |
| `src/enums/urgency.ts`                     | 14    |
| `src/enums/notification-policy.ts`         | 18    |
| `src/enums/thread-type.ts`                 | 16    |
| `src/enums/thread-state.ts`                | 26    |
| `src/enums/participant-role.ts`            | 27    |
| `src/enums/content-format.ts`              | 15    |
| `src/exceptions/comms-domain-error.ts`     | 9     |
| `src/exceptions/comms-validation-error.ts` | 23    |
| `src/entities/message.ts`                  | 205   |
| `src/entities/delivery-request.ts`         | 75    |
| `src/entities/delivery-attempt.ts`         | 115   |
| `src/entities/channel-preference.ts`       | 67    |
| `src/entities/message-receipt.ts`          | 45    |
| `src/entities/thread.ts`                   | 188   |
| `src/entities/thread-participant.ts`       | 123   |
| `src/entities/message-attachment.ts`       | 88    |
| `src/entities/message-reaction.ts`         | 59    |
| `src/value-objects/resolved-channels.ts`   | 14    |
| `src/rules/channel-resolution.ts`          | 51    |
| `src/rules/retry-policy.ts`                | 50    |
| `src/rules/thread-permissions.ts`          | 101   |

**Test files**: 23 files, ~2,330 lines total

---

**Assumptions documented**:

1. Channel preferences are per-contact (contactId), never per-user.
2. Urgency levels exhaustive: `normal` and `urgent` only.
3. Sensitive flag always takes precedence over urgency. `sensitive: true` + `urgency: "urgent"` = email-only.
4. All recipient resolution happens at processing time via geo-client; domain never holds raw emails/phones (except DeliveryAttempt.recipientAddress populated by infra).
5. No quiet hours or template wrapper in current domain.
6. `COMMS_RETRY.TIER_TTLS` and `RETRY_POLICY.DELAYS_MS` kept in sync manually.
7. Thread slugs not restricted to forum threads in domain (soft constraint).
8. MessageAttachment file storage is external (media service). Domain stores metadata only.
9. MessageReceipt uniqueness (messageId + userId) enforced at DB level, not in domain.
10. `softDeleteMessage` and `markParticipantLeft` are idempotent (overwrite timestamps).

---

**Findings**:

| #   | Severity | Category        | File:Line                                    | Description                                                                                                                                                                                                                                                      |
| --- | -------- | --------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Medium   | Maintainability | `constants/comms-constants.ts:8,52`          | **Duplicated delay arrays**: `RETRY_POLICY.DELAYS_MS` and `COMMS_RETRY.TIER_TTLS` both `[5000, 10000, 30000, 60000, 300000]` declared independently. JSDoc says "Matches RETRY_POLICY.DELAYS_MS" but manual invariant. Fix: `TIER_TTLS: RETRY_POLICY.DELAYS_MS`. |
| 2   | Medium   | Maintainability | `dist/` directory                            | **Stale dist artifacts**: `dist/` contains compiled output for 4 deleted source files: `quiet-hours.js`, `template-wrapper.js`, `recipient-validation.js`, `message-validation.js`. Clean build would fix.                                                       |
| 3   | Low      | Consistency     | `entities/message-attachment.ts:19`          | **`updatedAt` on immutable entity**: MessageAttachment documented as "Immutable — no updates" and has no update function, yet has `updatedAt`. Compare MessageReaction which correctly has only `createdAt`.                                                     |
| 4   | Low      | Test Gap        | `tests/unit/domain/constants.test.ts`        | **Missing tests for COMMS_MESSAGING and COMMS_RETRY constants**: Test only covers `RETRY_POLICY`, `DELIVERY_DEFAULTS`, `CHANNEL_DEFAULTS`, `THREAD_CONSTRAINTS`.                                                                                                 |
| 5   | Low      | Bug             | `rules/channel-resolution.ts:29-33`          | **Sensitive message forces email even if email disabled**: `sensitive=true` unconditionally adds `"email"`, ignoring `emailEnabled` preference. By design (safety: tokens must not leak via SMS) but product-level decision worth documenting more prominently.  |
| 6   | Low      | Consistency     | `entities/message.ts:117`                    | **Sender validation uses `!!` truthiness check**: Whitespace-only IDs pass as truthy. ID fields not run through `cleanStr()`.                                                                                                                                    |
| 7   | Low      | Elegance        | `rules/thread-permissions.ts:37-48,56-67`    | **`canEditMessage` and `canDeleteMessage` have identical logic**: Both check `isActive`, determine `isOwnMessage`, use same role thresholds. Could extract shared `canModifyMessage` helper.                                                                     |
| 8   | Low      | Test Gap        | `rules/channel-resolution.test.ts`           | **Missing test for `prefs=null` + `urgency="urgent"`**: Covers null+normal and non-null+urgent but not null+urgent.                                                                                                                                              |
| 9   | Low      | Consistency     | `entities/thread.ts` vs `COMMS_DOMAIN.md:95` | **Slug not restricted to forum threads**: Documentation says "forum only" but domain accepts slugs for any type.                                                                                                                                                 |
| 10  | Low      | Security        | `exceptions/comms-validation-error.ts:15`    | **PII potential in validation error messages**: `invalidValue` interpolated directly. Not a current risk (domain validates IDs, not PII), but worth noting for future fields.                                                                                    |
| 11  | Low      | Test Gap        | `entities/delivery-request.test.ts`          | **Missing idempotency test for `markDeliveryRequestProcessed`**: No test for calling on already-processed request.                                                                                                                                               |
| 12  | Low      | Test Gap        | `entities/message.test.ts`                   | **Missing idempotency test for `softDeleteMessage`**: No test for calling on already-deleted message.                                                                                                                                                            |
| 13  | Low      | Test Gap        | `entities/thread-participant.test.ts`        | **Missing idempotency test for `markParticipantLeft`**: No test for calling on already-left participant.                                                                                                                                                         |
| 14  | Low      | Maintainability | `entities/message.ts:91-98`                  | **Unreachable validation for default enum values**: Validates `contentFormat`/`urgency` but values come from typed inputs or known defaults. Only triggers if TypeScript bypassed.                                                                               |
| 15  | Low      | Maintainability | `COMMS_DOMAIN.md:152-153`                    | **Documentation claims tests cover COMMS_MESSAGING/COMMS_RETRY**: Actual test doesn't. Out of sync.                                                                                                                                                              |

---

**Tests to add**:

- [ ] `constants.test.ts`: Tests for `COMMS_MESSAGING.NOTIFICATIONS_QUEUE`
- [ ] `constants.test.ts`: Tests for `COMMS_RETRY` (all 5 properties)
- [ ] `constants.test.ts`: Assert `COMMS_RETRY.TIER_TTLS` deep-equals `RETRY_POLICY.DELAYS_MS`
- [ ] `channel-resolution.test.ts`: `prefs=null` + `urgency="urgent"` combination
- [ ] `message.test.ts`: `softDeleteMessage` on already-deleted message
- [ ] `delivery-request.test.ts`: `markDeliveryRequestProcessed` on already-processed request
- [ ] `thread-participant.test.ts`: `markParticipantLeft` on already-left participant
- [ ] `message.test.ts`: Whitespace-only sender IDs (`senderUserId: "  "`)
- [ ] `delivery-request.test.ts`: Whitespace-only `recipientContactId`

**Tests to remove**:

- (None — all existing tests are valid)
