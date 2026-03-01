# @d2/comms-app

CQRS handlers for the Comms service delivery engine. Pure application logic -- zero infra imports. Defines provider interfaces (IEmailProvider, ISmsProvider), repository handler interfaces, and CQRS handlers that orchestrate delivery and scheduled job execution.

## Purpose

The app layer sits between the domain (`@d2/comms-domain`) and infrastructure (`@d2/comms-infra`). It defines the contracts that infra must implement (repository handlers, providers) and contains the business orchestration logic. Consumed by:

- `@d2/comms-infra` (implements repository + provider interfaces)
- `@d2/comms-api` (resolves handlers from DI for gRPC RPCs and RabbitMQ consumer)

## Design Decisions

| Decision                        | Rationale                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Repository handler bundles      | Typed groupings (MessageRepoHandlers, etc.) reduce parameter lists in factories      |
| Provider interfaces as IHandler | Email/SMS providers extend BaseHandler -- same OTel tracing as all handlers          |
| Markdown rendering in Deliver   | `marked` + `isomorphic-dompurify` for XSS-safe markdown-to-HTML in email bodies      |
| Idempotency via correlationId   | Deliver checks for existing DeliveryRequest before processing, returns cached data   |
| Optional in-memory cache        | GetChannelPreference/SetChannelPreference accept optional cache for warm reads       |
| ServiceKeys in app, not infra   | Infra keys live in app (interfaces defined here); prevents circular deps             |
| DI via addCommsApp(services)    | All CQRS handlers registered as transient -- new instance per resolve                |
| CommsJobOptions via Options     | Job retention periods, lock TTL, batch size passed to addCommsApp; sensible defaults |
| Distributed lock for jobs       | AcquireLock/ReleaseLock prevent concurrent job runs across instances                 |

## Package Structure

```
src/
  index.ts                              Barrel exports + createDeliveryHandlers factory
  registration.ts                       addCommsApp(services, jobOptions?) DI registration
  service-keys.ts                       17 infra keys + 7 app keys (ServiceKey<T>)
  comms-job-options.ts                  CommsJobOptions interface + DEFAULT_COMMS_JOB_OPTIONS
  interfaces/
    providers/
      index.ts                          Re-exports email + sms provider interfaces
      email/
        email-provider.ts               IEmailProvider = IHandler<SendEmailInput, SendEmailOutput>
        index.ts
      sms/
        sms-provider.ts                 ISmsProvider = IHandler<SendSmsInput, SendSmsOutput>
        index.ts
    repository/
      handlers/
        index.ts                        Re-exports all repo handler types + bundle interfaces
        c/
          create-message-record.ts              ICreateMessageRecordHandler
          create-delivery-request-record.ts     ICreateDeliveryRequestRecordHandler
          create-delivery-attempt-record.ts     ICreateDeliveryAttemptRecordHandler
          create-channel-preference-record.ts   ICreateChannelPreferenceRecordHandler
        r/
          find-message-by-id.ts                 IFindMessageByIdHandler
          find-delivery-request-by-id.ts        IFindDeliveryRequestByIdHandler
          find-delivery-request-by-correlation-id.ts  IFindDeliveryRequestByCorrelationIdHandler
          find-delivery-attempts-by-request-id.ts     IFindDeliveryAttemptsByRequestIdHandler
          find-channel-preference-by-contact-id.ts    IFindChannelPreferenceByContactIdHandler
        u/
          mark-delivery-request-processed.ts    IMarkDeliveryRequestProcessedHandler
          update-delivery-attempt-status.ts     IUpdateDeliveryAttemptStatusHandler
          update-channel-preference-record.ts   IUpdateChannelPreferenceRecordHandler
        d/
          purge-deleted-messages.ts             IPurgeDeletedMessagesHandler
          purge-delivery-history.ts             IPurgeDeliveryHistoryHandler
  implementations/
    cqrs/
      handlers/
        x/
          deliver.ts                    Deliver (Complex) -- core delivery orchestrator
        c/
          set-channel-preference.ts     SetChannelPreference (Command) -- upsert channel prefs
          run-deleted-message-purge.ts  RunDeletedMessagePurge (Command) -- purge soft-deleted messages
          run-delivery-history-purge.ts RunDeliveryHistoryPurge (Command) -- purge old delivery history
        q/
          resolve-recipient.ts          RecipientResolver (Query) -- contactId to email/phone
          get-channel-preference.ts     GetChannelPreference (Query) -- read channel prefs
```

## CQRS Handlers

| Handler                 | Category | Dir  | Description                                                                                                                                     |
| ----------------------- | -------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Deliver                 | Complex  | `x/` | Full delivery orchestrator: create Message + Request, resolve recipient, pick channels, render markdown, dispatch via providers, handle retries |
| RecipientResolver       | Query    | `q/` | Resolves contactId to email/phone via `GetContactsByIds` (geo-client)                                                                           |
| SetChannelPreference    | Command  | `c/` | Upsert per-contact channel preferences (email/sms enabled flags)                                                                                |
| RunDeletedMessagePurge  | Command  | `c/` | Acquires distributed lock, purges soft-deleted messages older than retention cutoff                                                             |
| RunDeliveryHistoryPurge | Command  | `c/` | Acquires distributed lock, purges delivery requests/attempts older than retention cutoff                                                        |
| GetChannelPreference    | Query    | `q/` | Read channel preferences with optional in-memory cache (15min TTL)                                                                              |
| CheckHealth             | Query    | `q/` | Aggregates DB, cache, and message bus pings into health report                                                                                  |

### Deliver Handler Flow

1. **Idempotency check** -- look up existing DeliveryRequest by correlationId
2. **Create domain entities** -- Message + DeliveryRequest via domain factories
3. **Persist** -- save Message and DeliveryRequest via repository handlers
4. **Resolve recipient** -- call RecipientResolver for email/phone from contactId
5. **Resolve channel preferences** -- fetch ChannelPreference from DB
6. **Apply channel resolution rule** -- `resolveChannels(prefs, message)` from domain
7. **Filter deliverable channels** -- only channels with a resolved address
8. **Dispatch per channel** -- email via `IEmailProvider` (markdown rendered + HTML wrapped), SMS via `ISmsProvider`
9. **Handle failures** -- failed attempts with retryable state get `DELIVERY_FAILED` error code; consumer schedules DLX retry
10. **Mark processed** -- when all attempts are terminal, mark DeliveryRequest as processed

### Markdown Rendering

Email content goes through a two-step pipeline:

1. `marked.parse()` -- full CommonMark markdown to raw HTML
2. `DOMPurify.sanitize()` -- XSS protection (strips script tags, event handlers, etc.)

The sanitized HTML is then interpolated into an email wrapper template with `{{title}}`, `{{body}}`, and `{{unsubscribeUrl}}` placeholders. A default template is provided; callers can override via `EmailWrapperOptions`.

### Job Handler Flow (RunDeletedMessagePurge / RunDeliveryHistoryPurge)

Both job handlers follow the same pattern:

1. **Acquire distributed lock** -- `AcquireLock` via Redis with configurable TTL (default 5min)
2. **Skip if locked** -- if another instance holds the lock, return `{ lockAcquired: false, rowsAffected: 0 }`
3. **Compute cutoff date** -- current time minus retention period (90 days for messages, 365 days for history)
4. **Delegate to repository purge handler** -- passes cutoff date + batch size to infra-layer handler
5. **Release lock** -- always releases in `finally` block, even on failure

Output includes `rowsAffected`, `lockAcquired`, and `durationMs` for job monitoring.

## CommsJobOptions

Configuration for scheduled job handlers, passed to `addCommsApp(services, jobOptions)`:

| Field                          | Type   | Default | Description                                |
| ------------------------------ | ------ | ------- | ------------------------------------------ |
| `deletedMessageRetentionDays`  | number | 90      | Retention period for soft-deleted messages |
| `deliveryHistoryRetentionDays` | number | 365     | Retention period for delivery history      |
| `jobLockTtlMs`                 | number | 300,000 | Distributed lock TTL (5 minutes)           |

`DEFAULT_COMMS_JOB_OPTIONS` provides sensible defaults when no env vars are configured. Infra-layer purge handlers use `DEFAULT_BATCH_SIZE` (500) from `@d2/batch-pg` internally -- batch size is not passed via handler input.

## Provider Interfaces

| Interface      | Input                                        | Output                  |
| -------------- | -------------------------------------------- | ----------------------- |
| IEmailProvider | `{ to, subject, html, plainText, replyTo? }` | `{ providerMessageId }` |
| ISmsProvider   | `{ to, body }`                               | `{ providerMessageId }` |

Both extend `IHandler<TInput, TOutput>` -- they ARE handlers, with full OTel span tracing and redaction support.

## Repository Handler Interfaces

### Bundles (used by delivery handlers)

| Bundle                          | Handlers                                             |
| ------------------------------- | ---------------------------------------------------- |
| `MessageRepoHandlers`           | create, findById                                     |
| `DeliveryRequestRepoHandlers`   | create, findById, findByCorrelationId, markProcessed |
| `DeliveryAttemptRepoHandlers`   | create, findByRequestId, updateStatus                |
| `ChannelPreferenceRepoHandlers` | create, findByContactId, update                      |

### Delete (D/) -- 2 handlers (used by job handlers)

| Handler                      | Input            | Output             |
| ---------------------------- | ---------------- | ------------------ |
| IPurgeDeletedMessagesHandler | `{ cutoffDate }` | `{ rowsAffected }` |
| IPurgeDeliveryHistoryHandler | `{ cutoffDate }` | `{ rowsAffected }` |

## Service Keys (DI)

26 total ServiceKeys split across three categories:

**Infra keys** (interfaces defined in app, implemented in infra): 12 repository handler keys + 2 purge handler keys + 1 PingDb key + 2 provider keys = 17

**App keys** (defined and implemented in app): `IDeliverKey`, `IRecipientResolverKey`, `ISetChannelPreferenceKey`, `IGetChannelPreferenceKey`, `ICheckHealthKey`, `IRunDeletedMessagePurgeKey`, `IRunDeliveryHistoryPurgeKey`

**Lock keys** (created via `createRedisAcquireLockKey`/`createRedisReleaseLockKey` with `"comms"` prefix): `ICommsAcquireLockKey`, `ICommsReleaseLockKey`

## Registration

```ts
import { addCommsApp } from "@d2/comms-app";

addCommsApp(services); // registers all CQRS handlers as transient (default job options)
addCommsApp(services, customJobOptions); // or with custom CommsJobOptions
```

Requires infra keys and lock keys to already be registered (called after `addCommsInfra`; lock handlers registered as singletons in composition root).

## Tests

All tests are in `@d2/comms-tests` (`backends/node/services/comms/tests/`):

```
src/unit/app/
  factories.test.ts                 createDeliveryHandlers factory tests
  handlers/
    deliver.test.ts                 Deliver handler (mocked repos + providers)
    resolve-recipient.test.ts       RecipientResolver handler (mocked geo-client)
  helpers/
    mock-handlers.ts                Shared mock handler factories
src/unit/jobs/
  run-deleted-message-purge.test.ts     RunDeletedMessagePurge unit tests
  run-delivery-history-purge.test.ts    RunDeliveryHistoryPurge unit tests
src/integration/
  job-purge-handlers.test.ts            PurgeDeletedMessages + PurgeDeliveryHistory integration tests
```

## Dependencies

| Package                | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `@d2/comms-domain`     | Domain entities, enums, rules                          |
| `@d2/di`               | ServiceKey, ServiceCollection for DI                   |
| `@d2/geo-client`       | GetContactsByIds handler type for recipient resolution |
| `@d2/handler`          | BaseHandler, IHandlerContext, zodGuid                  |
| `@d2/interfaces`       | InMemoryCache handler types for optional caching       |
| `@d2/result`           | D2Result return type                                   |
| `@d2/utilities`        | UUIDv7 generation                                      |
| `isomorphic-dompurify` | XSS-safe HTML sanitization for email bodies            |
| `marked`               | Markdown to HTML rendering (CommonMark)                |
| `zod`                  | Input validation schemas                               |
