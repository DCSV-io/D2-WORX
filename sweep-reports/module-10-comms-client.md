### Module 10: Comms Client

**Files reviewed** (with line counts):

| File | Lines |
|------|-------|
| `comms/client/src/index.ts` | 7 |
| `comms/client/src/handlers/pub/notify.ts` | 93 |
| `comms/client/src/comms-client-constants.ts` | 10 |
| `comms/client/src/service-keys.ts` | 4 |
| `comms/client/src/registration.ts` | 20 |
| `comms/client/package.json` | 26 |
| `comms/client/tsconfig.json` | 8 |
| `comms/client/COMMS_CLIENT.md` | 149 |
| `comms/tests/src/unit/client/notify.test.ts` | 308 |
| **Total source** | **134** |
| **Total tests** | **308** |

---

**Assumptions documented**:

1. Assumes RabbitMQ connection is established and `IMessagePublisher` is functional before `notify.handleAsync()` is called. Disconnection mid-flight surfaces as unhandled exception caught by BaseHandler.
2. Assumes `recipientContactId` is a valid UUID that exists in Geo service. No existence check — consumer's `RecipientResolver` handles "contact not found."
3. Assumes callers have already resolved contactId from userId (via `@d2/geo-client`). Client never performs resolution.
4. Assumes RabbitMQ fanout exchange `comms.notifications` already exists or will be declared by the consumer on startup. Client's publisher does NOT declare the exchange.
5. Assumes `correlationId` uniqueness is caller's responsibility. Client validates format not uniqueness.
6. Assumes message body is JSON-serializable. `metadata: Record<string, unknown>` has no serialization constraints enforced.
7. Assumes `publisher.send()` returns only after message is durably enqueued (publisher confirms enabled).

---

**Findings**:

| #  | Severity | Category        | File:Line | Description |
|----|----------|-----------------|-----------|-------------|
| 1  | Medium   | Security        | `notify.ts:25` | **No RedactionSpec on Notify handler.** Processes PII-containing fields (`content`, `plaintext` contain user names, verification URLs, password reset URLs). BaseHandler logs full input at DEBUG level without redaction. Should declare `inputFields: ["content", "plaintext"]` at minimum. |
| 2  | Low      | Security        | `notify.ts:39` | **`metadata` field allows arbitrary depth/size.** `z.record(z.unknown()).optional()` permits deeply nested objects of unbounded size. No max-depth or max-serialized-size guard. Mitigated by trusted internal callers only. |
| 3  | Low      | Consistency     | `notify.ts:31` | **Redundant `.min(1)` on `z.string().uuid()`.** UUID validator already guarantees non-empty 36-char string. No-op validation. |
| 4  | Low      | Bug             | `notify.ts:37` | **`correlationId` max length of 36 matches UUID format, but field typed as `string` not UUID.** If intent is "must be UUID," should use `.uuid()`. If "any string key," max should be larger. Ambiguous. |
| 5  | Low      | Consistency     | `notify.ts:82-83` | **Defaults applied in two places.** Zod schema has `.default(false)` for `sensitive` and `.default("normal")` for `urgency`, but `validateInput` discards parsed output — uses original `input` with `??` operators. Zod `.default()` calls are misleading (unused). Should be `.optional()` or documented. |
| 6  | Low      | Maintainability | `notify.ts` vs `notification-consumer.ts` | **`NotifyInput` interface duplicated as `NotificationMessage` in consumer.** Consumer re-declares message shape rather than importing from `@d2/comms-client`. Risk of shapes drifting. Currently in sync. |
| 7  | Low      | Test Gap        | `notify.test.ts` | **No boundary test for `correlationId` max length (36 chars).** |
| 8  | Low      | Test Gap        | `notify.test.ts` | **No boundary test for `senderService` max length (50 chars).** |
| 9  | Low      | Test Gap        | `notify.test.ts` | **No boundary test for `plaintext` max length (50,000 chars).** Content max tested but not plaintext. |
| 10 | Low      | Elegance        | `registration.ts:15-19` | **Publisher baked into factory closure at registration time.** Cannot swap publishers after registration. Fine for current architecture. |
| 11 | Low      | Consistency     | `notify.ts:64-69` | **No-publisher fallback partially redacts (omits content/plaintext) while with-publisher path (BaseHandler debug) would log everything.** Related to finding #1. |

---

**Tests to add**:

- [ ] `correlationId` at exactly 36 chars (boundary pass)
- [ ] `correlationId` at 37 chars (boundary fail)
- [ ] `senderService` at exactly 50 chars (boundary pass)
- [ ] `senderService` at 51 chars (boundary fail)
- [ ] `plaintext` at exactly 50,000 chars (boundary pass)
- [ ] `plaintext` exceeding 50,000 chars (boundary fail — mirrors content test)
- [ ] `content` at exactly 50,000 chars (boundary pass — complements existing >50k test)
- [ ] `metadata` with non-serializable values (circular references, functions)

**Tests to remove**:

- None — all 26 existing tests are well-structured and meaningful
