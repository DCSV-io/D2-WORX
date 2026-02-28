# @d2/comms-infra

Infrastructure implementations for the Comms service. Drizzle ORM repositories, Resend email provider, Twilio SMS provider, RabbitMQ notification consumer with DLX-based retry topology.

## Purpose

Implements the repository and provider interfaces defined in `@d2/comms-app`. Owns the database schema, migrations, external API integrations, and messaging infrastructure. Consumed by:

- `@d2/comms-api` (composition root wires infra into DI)
- `@d2/comms-tests` (integration tests against Testcontainers)

## Design Decisions

| Decision                           | Rationale                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Drizzle ORM (not Kysely)           | Consistent with Auth service -- single ORM across all Node.js services (ADR-009) |
| 14 handler-per-file repo pattern   | Mirrors .NET TLC convention: one handler per file, organized by C/R/U/D          |
| Factory functions for repo bundles | `createMessageRepoHandlers(db, ctx)` groups related handlers for composition     |
| Providers as singleton             | Hold API client connections (Resend, Twilio) -- shared across all requests       |
| DLX-based retry topology           | Tier queues with escalating TTLs dead-letter back to main queue on expiry        |
| Always ACK + re-publish for retry  | Never NACK/requeue -- retry is explicit via tier queues for predictable delays   |
| Conditional provider registration  | Missing API keys = no registration (warn log, not crash)                         |

## Package Structure

```
src/
  index.ts                              Barrel exports
  registration.ts                       addCommsInfra(services, db) DI registration
  service-keys.ts                       Re-exports from @d2/comms-app (for internal use)
  repository/
    migrate.ts                          runMigrations(pool) -- Drizzle migrator (idempotent)
    migrations/
      0000_solid_magik.sql              Initial schema (message, delivery_request, delivery_attempt, channel_preference)
      0001_useful_mantis.sql            Schema additions
      meta/                             Drizzle migration metadata (journal + snapshots)
    schema/
      index.ts                          Re-exports tables + types
      tables.ts                         Drizzle table definitions (4 tables)
      types.ts                          Inferred row/insert types (MessageRow, NewMessage, etc.)
    handlers/
      factories.ts                      4 factory functions that instantiate handler bundles
      c/
        create-message-record.ts                CreateMessageRecord
        create-delivery-request-record.ts       CreateDeliveryRequestRecord
        create-delivery-attempt-record.ts       CreateDeliveryAttemptRecord
        create-channel-preference-record.ts     CreateChannelPreferenceRecord
      r/
        find-message-by-id.ts                   FindMessageById
        find-delivery-request-by-id.ts          FindDeliveryRequestById
        find-delivery-request-by-correlation-id.ts  FindDeliveryRequestByCorrelationId
        find-delivery-attempts-by-request-id.ts     FindDeliveryAttemptsByRequestId
        find-channel-preference-by-contact-id.ts    FindChannelPreferenceByContactId
      u/
        mark-delivery-request-processed.ts      MarkDeliveryRequestProcessed
        update-delivery-attempt-status.ts       UpdateDeliveryAttemptStatus
        update-channel-preference-record.ts     UpdateChannelPreferenceRecord
      d/
        purge-deleted-messages.ts               PurgeDeletedMessages (batchDelete soft-deleted messages)
        purge-delivery-history.ts               PurgeDeliveryHistory (FK-aware: attempts then requests)
  providers/
    email/
      resend/
        resend-email-provider.ts        ResendEmailProvider (implements IEmailProvider)
    sms/
      twilio/
        twilio-sms-provider.ts          TwilioSmsProvider (implements ISmsProvider)
  messaging/
    consumers/
      notification-consumer.ts          createNotificationConsumer (RabbitMQ subscriber)
    retry-topology.ts                   declareRetryTopology + getRetryTierQueue
  templates/                            (reserved for future use)
```

## Database Schema

Four tables in the comms database (PostgreSQL 18):

| Table                | Key Columns                                                                    | Indexes                                                                           |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `message`            | id (PK), thread*id, sender*\*, content, plain_text_content, urgency, sensitive | idx_message_thread_id, idx_message_sender_user_id                                 |
| `delivery_request`   | id (PK), message_id, correlation_id, recipient_contact_id, processed_at        | idx_delivery_request_message_id, UNIQUE(correlation_id), idx_recipient_contact_id |
| `delivery_attempt`   | id (PK), request_id, channel, recipient_address, status, attempt_number        | idx_delivery_attempt_request_id, idx_status_retry                                 |
| `channel_preference` | id (PK), contact_id, email_enabled, sms_enabled                                | UNIQUE(contact_id)                                                                |

All primary keys are UUIDv7 (varchar 36). Timestamps use `timestamptz`. Column names are `snake_case`.

## Repository Handlers (14)

Organized by TLC convention (C/R/U/D):

### Create (C/) -- 4 handlers

| Handler                       | Input         | Output        |
| ----------------------------- | ------------- | ------------- |
| CreateMessageRecord           | `{ message }` | `{ message }` |
| CreateDeliveryRequestRecord   | `{ request }` | `{ request }` |
| CreateDeliveryAttemptRecord   | `{ attempt }` | `{ attempt }` |
| CreateChannelPreferenceRecord | `{ pref }`    | `{ pref }`    |

### Read (R/) -- 5 handlers

| Handler                            | Input               | Output           |
| ---------------------------------- | ------------------- | ---------------- |
| FindMessageById                    | `{ id }`            | `{ message }`    |
| FindDeliveryRequestById            | `{ id }`            | `{ request }`    |
| FindDeliveryRequestByCorrelationId | `{ correlationId }` | `{ request }`    |
| FindDeliveryAttemptsByRequestId    | `{ requestId }`     | `{ attempts[] }` |
| FindChannelPreferenceByContactId   | `{ contactId }`     | `{ pref }`       |

### Update (U/) -- 3 handlers

| Handler                       | Input                                                      | Output        |
| ----------------------------- | ---------------------------------------------------------- | ------------- |
| MarkDeliveryRequestProcessed  | `{ id }`                                                   | `{ request }` |
| UpdateDeliveryAttemptStatus   | `{ id, status, providerMessageId?, error?, nextRetryAt? }` | `{ attempt }` |
| UpdateChannelPreferenceRecord | `{ pref }`                                                 | `{ pref }`    |

### Delete (D/) -- 2 handlers

| Handler              | Input            | Output             | Notes                                                                  |
| -------------------- | ---------------- | ------------------ | ---------------------------------------------------------------------- |
| PurgeDeletedMessages | `{ cutoffDate }` | `{ rowsAffected }` | `batchDelete` on `message` where `deletedAt < cutoff`                  |
| PurgeDeliveryHistory | `{ cutoffDate }` | `{ rowsAffected }` | FK-aware: deletes `delivery_attempt` then `delivery_request` per batch |

Both use `batchDelete` from `@d2/batch-pg` with `DEFAULT_BATCH_SIZE` (500) internally -- batch size is not passed via handler input. Select IDs in batches, delete in chunks to avoid long-running transactions. `PurgeDeliveryHistory` handles the FK dependency by deleting child `delivery_attempt` rows before parent `delivery_request` rows within each batch.

## Providers

| Provider            | External API | Singleton | Redacted Fields |
| ------------------- | ------------ | --------- | --------------- |
| ResendEmailProvider | Resend       | Yes       | html, plainText |
| TwilioSmsProvider   | Twilio       | Yes       | body            |

Both extend `BaseHandler` and return `D2Result<{ providerMessageId }>`. Failures return 503 with the provider error message.

## RabbitMQ Consumer

`createNotificationConsumer(deps)` subscribes to the `comms.notifications` queue (bound to the fanout exchange published by `@d2/comms-client`). For each message:

1. Validate required fields (recipientContactId, title, correlationId) -- drop if invalid
2. Create DI scope with fresh traceId
3. Resolve `Deliver` handler and dispatch
4. On `DELIVERY_FAILED` error code or unexpected error: schedule retry via tier queue
5. At max attempts (10): log and drop
6. Always ACK -- retry is via re-publish, never NACK

## Retry Topology

DLX-based retry with 5 tier queues and escalating TTLs:

| Tier | Queue Name           | TTL  |
| ---- | -------------------- | ---- |
| 1    | `comms.retry.tier-1` | 5s   |
| 2    | `comms.retry.tier-2` | 10s  |
| 3    | `comms.retry.tier-3` | 30s  |
| 4    | `comms.retry.tier-4` | 60s  |
| 5    | `comms.retry.tier-5` | 300s |

Each tier queue dead-letters to `comms.retry.requeue` (direct exchange), which routes expired messages back to `comms.notifications` (main queue). Retry count 0-3 map to tiers 1-4; count 4+ caps at tier 5. `getRetryTierQueue(retryCount)` returns `null` at 10 attempts.

`declareRetryTopology(messageBus)` must be called once at startup before the consumer begins.

## Registration

```ts
import { addCommsInfra } from "@d2/comms-infra";

addCommsInfra(services, db);
```

`addCommsInfra` registers **only** the 14 repository handlers (12 CRUD + 2 purge) + PingDb health-check handler as **transient**.

Delivery providers (Resend email, Twilio SMS) are registered as **singleton instances** in the composition root (`@d2/comms-api`), not here -- they hold API client connections and use service-level HandlerContext. See `COMMS_API.md` for provider wiring.

## Tests

All tests are in `@d2/comms-tests` (`backends/node/services/comms/tests/`):

```
src/unit/infra/
  resend-email-provider.test.ts         Resend provider (mocked Resend client)
  twilio-sms-provider.test.ts           Twilio provider (mocked Twilio client)
  retry-topology.test.ts                getRetryTierQueue mapping + declareRetryTopology
src/integration/
  message-repository.test.ts            Message CRUD (Testcontainers PG)
  delivery-request-repository.test.ts   DeliveryRequest CRUD + correlationId lookup
  delivery-attempt-repository.test.ts   DeliveryAttempt CRUD + status updates
  deliver-handler.test.ts               Full Deliver flow (Testcontainers PG + mocked providers)
  notification-consumer.test.ts         RabbitMQ consumer + DLX retry (Testcontainers RabbitMQ)
  helpers/
    postgres-test-helpers.ts            startPostgres, stopPostgres, cleanAllTables
    rabbitmq-test-helpers.ts            RabbitMQ container helpers
    handler-test-helpers.ts             Handler instantiation helpers
    test-context.ts                     createTestContext (silent logger, no auth)
```

## Dependencies

| Package            | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `@d2/comms-app`    | Repository + provider interfaces, service keys |
| `@d2/comms-client` | COMMS_EVENTS constant (exchange name)          |
| `@d2/comms-domain` | Domain entities, constants (retry/messaging)   |
| `@d2/di`           | ServiceCollection for DI registration          |
| `@d2/handler`      | BaseHandler, IHandlerContext                   |
| `@d2/logging`      | ILogger for consumer logging                   |
| `@d2/messaging`    | MessageBus, IMessagePublisher, ConsumerResult  |
| `@d2/result`       | D2Result return type                           |
| `@d2/utilities`    | UUIDv7 generation                              |
| `@d2/batch-pg`     | batchDelete utility for purge handlers         |
| `drizzle-orm`      | ORM for PostgreSQL repository handlers         |
| `pg`               | PostgreSQL driver                              |
| `resend`           | Resend API client for email delivery           |
| `twilio`           | Twilio API client for SMS delivery             |
