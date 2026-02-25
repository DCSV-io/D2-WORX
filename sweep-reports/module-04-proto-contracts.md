### Module 4: Proto Contracts + @d2/protos

**Files reviewed**:

| File                                                                       | Lines |
| -------------------------------------------------------------------------- | ----- |
| `contracts/protos/common/v1/d2_result.proto`                              | 20    |
| `contracts/protos/common/v1/ping.proto`                                   | 20    |
| `contracts/protos/common/v1/health.proto`                                 | 23    |
| `contracts/protos/geo/v1/geo.proto`                                       | 430   |
| `contracts/protos/comms/v1/comms.proto`                                   | 448   |
| `contracts/protos/events/v1/auth_events.proto`                            | 37    |
| `contracts/protos/events/v1/geo_events.proto`                             | 24    |
| `backends/node/shared/protos/src/index.ts`                                | 184   |
| `backends/node/shared/protos/src/generated/common/v1/d2_result.ts`        | 282   |
| `backends/node/shared/protos/src/generated/common/v1/ping.ts`             | 233   |
| `backends/node/shared/protos/src/generated/common/v1/health.ts`           | 398   |
| `backends/node/shared/protos/src/generated/geo/v1/geo.ts`                 | 6434  |
| `backends/node/shared/protos/src/generated/comms/v1/comms.ts`             | 6529  |
| `backends/node/shared/protos/src/generated/events/v1/auth_events.ts`      | 583   |
| `backends/node/shared/protos/src/generated/events/v1/geo_events.ts`       | 280   |
| `backends/node/shared/protos/src/generated/google/protobuf/timestamp.ts`  | 219   |
| `backends/node/shared/protos/package.json`                                | 28    |
| `backends/node/shared/protos/tsconfig.json`                               | 9     |
| `backends/node/shared/protos/buf.gen.yaml`                                | 14    |
| `backends/node/shared/protos/PROTOS.md`                                   | 51    |
| `backends/node/shared/tests/src/unit/protos.test.ts`                      | 419   |
| `backends/node/shared/tests/src/unit/protos/event-contract.test.ts`       | 131   |

---

**Assumptions documented**:

1. All proto files use `proto3` syntax exclusively. No `proto2` features are used.
2. Proto field numbers are sequential and never reused -- field numbers follow 1, 2, 3... with no gaps within any individual message.
3. Both .NET and Node.js consume from the same `contracts/protos/` directory (single source of truth).
4. `forceLong=string` in `buf.gen.yaml` means all `int64`/`uint64` proto fields are represented as `string` in TypeScript (not `number` or `bigint`).
5. Generated code is committed to source control (both `src/generated/` and `dist/`). No CI-time code generation step required.
6. Events are serialized as JSON over RabbitMQ (not binary protobuf), hence `fromJSON`/`toJSON` contract tests rather than binary encode/decode tests.
7. The `comms.proto` defines future Phase 2 + Phase 3 RPCs as stubs, even though only Phase 1 is implemented.
8. The `auth/v1/` proto directory exists but is currently empty -- Auth service does not expose a gRPC API yet (planned for Stage C).
9. The `csharp_namespace` option is consistently set on all proto files. No equivalent `go_package` option exists for future Go consumers.
10. `google.protobuf.Timestamp` is used for date/time fields in Geo and Comms but is converted to/from JavaScript `Date` by ts-proto.

---

**Findings**:

| #  | Severity | Category        | File:Line                                          | Description |
|----|----------|-----------------|-----------------------------------------------------|-------------|
| 1  | High     | Consistency     | `comms/v1/comms.proto:58-69`                       | **Proto contract retains dropped fields.** `ChannelPreferenceDTO` still defines `quiet_hours_start` (6), `quiet_hours_end` (7), `quiet_hours_tz` (8), and `user_id` (2). The domain, DB migration (0001), and mapper all explicitly removed these. Fields should be marked `reserved` to prevent field number reuse and document the removal. |
| 2  | High     | Consistency     | `comms/v1/comms.proto:82-93`                       | **`DeliveryRequestDTO` retains `recipient_user_id` (4) and `template_name` (7)** which were removed in the domain simplification. The mapper explicitly does NOT set these. Should be `reserved` field numbers. |
| 3  | High     | Consistency     | `comms/v1/comms.proto:71-80`                       | **`TemplateWrapperDTO` is defined but the table was dropped.** Migration `0001_useful_mantis.sql` drops the `template_wrapper` table. The `GetTemplate`/`UpsertTemplate` RPCs and their request/response messages reference this dropped entity. These RPCs are unreachable dead code. |
| 4  | Medium   | Consistency     | `package.json:21-26`                               | **Version ranges violate project convention.** Uses `^2.5.0`, `^1.12.0`, `^1.65.0`, `^2.6.0` (caret ranges). CLAUDE.md mandates exact pinned versions. |
| 5  | Medium   | Maintainability | `comms/v1/comms.proto` (entire file)               | **Proto contract defines full Phase 2+3 stubs that don't exist in implementation.** 13 RPCs defined but only 5 implemented. DTOs (`ThreadDTO`, `MessageDTO`, `NotificationDTO`, `ReactionDTO`, `ParticipantDTO`) may drift from final designs. |
| 6  | Medium   | Bug             | `protos/dist/generated/common/common.v1/`          | **Stale dist artifacts from old directory structure.** `dist/` contains files at `dist/generated/common/common.v1/` (double `common/`) alongside the correct `dist/generated/common/v1/`. Harmless but should be cleaned up. |
| 7  | Medium   | Security        | `events/v1/auth_events.proto:4-5,18-19`            | **Sensitive tokens in event payloads.** `SendVerificationEmailEvent.token` and `SendPasswordResetEvent.token` carry raw verification/reset tokens over RabbitMQ as JSON. No field-level annotation for log redaction. If any consumer logs the full event body, tokens leak. |
| 8  | Medium   | Security        | `events/v1/auth_events.proto:2,18`                 | **PII in event payloads without redaction markers.** `email`, `invitee_email`, `inviter_email` fields carry raw email addresses. No equivalent of `RedactionSpec` for proto messages. |
| 9  | Medium   | Cross-language  | All `.proto` files                                 | **No `go_package` option.** All proto files set `csharp_namespace` but none set `go_package`. `backends/go/` exists for future Media service. Adding now avoids batch change later. |
| 10 | Medium   | Consistency     | `common/v1/health.proto:19-20` vs `comms/v1/comms.proto:102-103` | **Inconsistent type for latency.** `ComponentHealth.latency_ms` is `int64` (maps to `string` in TS). Will never exceed int32 range; using `int32` would simplify the TypeScript API. |
| 11 | Low      | Consistency     | `common/v1/ping.proto:18`                          | **`PingResponse.timestamp` uses `int64` instead of `google.protobuf.Timestamp`.** Geo and Comms use `Timestamp` for temporal values. Ping uses a different representation for the same concept. |
| 12 | Low      | Consistency     | `common/v1/health.proto:11`                        | **`CheckHealthResponse.timestamp` is `string` rather than `google.protobuf.Timestamp`.** Inconsistent with Geo/Comms pattern. |
| 13 | Low      | Maintainability | `PROTOS.md:35`                                     | **Documentation references `DeliverRequest/Response` which does not exist.** Correct names are `GetDeliveryStatusRequest/Response`. |
| 14 | Low      | Maintainability | `geo/v1/geo.proto`                                 | **No comments on many Geo DTO messages.** `CoordinatesDTO`, `StreetAddressDTO`, `EmailAddressDTO`, `PhoneNumberDTO`, `PersonalDTO`, `ProfessionalDTO`, `ContactMethodsDTO` lack doc comments. |
| 15 | Low      | Consistency     | `geo/v1/geo.proto:347-348`                         | **`PersonalDTO.date_of_birth` is `string` but no format specified.** ISO 8601? Free text? Similarly, `biological_sex` has no documented valid values. |
| 16 | Low      | Consistency     | `events/v1` namespace                              | **Events namespace drops service name** (correct since events are cross-service). Noted for documentation only. |
| 17 | Low      | Consistency     | `geo/v1/geo.proto:134,179`                         | **`GetContactsExtKeys` message name reused for Delete operations.** A more neutral name like `ContactExtKeys` would be clearer. |
| 18 | Low      | Test Gap        | N/A                                                | **No roundtrip encode/decode tests for `CommsServiceService`.** Tests exist for `PingServiceService` and `GeoServiceService` but not Comms. |
| 19 | Low      | Test Gap        | N/A                                                | **No contract test for `ContactsEvictedEvent`.** The `event-contract.test.ts` tests auth events and `GeoRefDataUpdatedEvent` but not `ContactsEvictedEvent`. |
| 20 | Low      | Maintainability | `contracts/protos/auth/v1/`                        | **Empty `auth/v1/` directory.** Expected (Auth gRPC API planned for Stage C), but could confuse contributors. |

---

**Tests to add**:

- [ ] Roundtrip encode/decode tests for `CommsServiceService` (all 5 Phase 1 RPCs) -- mirrors `GeoServiceService` test pattern
- [ ] JSON fixture + contract test for `ContactsEvictedEvent` in `event-contract.test.ts`
- [ ] CommsService DTO type shape verification tests for `ChannelPreferenceDTO`, `DeliveryRequestDTO`, `DeliveryAttemptDTO`

**Tests to remove**:

- [ ] None -- all existing tests are valid and relevant
