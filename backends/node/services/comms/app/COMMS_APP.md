# @d2/comms-app

CQRS handlers for the Comms service delivery engine. Pure application logic -- zero infra imports. Defines provider interfaces (IEmailProvider, ISmsProvider), repository handler interfaces, and four CQRS handlers that orchestrate delivery.

## Purpose

The app layer sits between the domain (`@d2/comms-domain`) and infrastructure (`@d2/comms-infra`). It defines the contracts that infra must implement (repository handlers, providers) and contains the business orchestration logic. Consumed by:

- `@d2/comms-infra` (implements repository + provider interfaces)
- `@d2/comms-api` (resolves handlers from DI for gRPC RPCs and RabbitMQ consumer)

## Design Decisions

| Decision                            | Rationale                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Repository handler bundles          | Typed groupings (MessageRepoHandlers, etc.) reduce parameter lists in factories    |
| Provider interfaces as IHandler     | Email/SMS providers extend BaseHandler -- same OTel tracing as all handlers        |
| Markdown rendering in Deliver       | `marked` + `isomorphic-dompurify` for XSS-safe markdown-to-HTML in email bodies    |
| Idempotency via correlationId       | Deliver checks for existing DeliveryRequest before processing, returns cached data |
| Optional in-memory cache            | GetChannelPreference/SetChannelPreference accept optional cache for warm reads     |
| ServiceKeys in app, not infra       | Infra keys live in app (interfaces defined here); prevents circular deps           |
| DI via addCommsApp(services)        | All CQRS handlers registered as transient -- new instance per resolve              |

## Package Structure

```
src/
  index.ts                              Barrel exports + createDeliveryHandlers factory
  registration.ts                       addCommsApp(services) DI registration
  service-keys.ts                       16 infra keys + 4 app keys (ServiceKey<T>)
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
  implementations/
    cqrs/
      handlers/
        x/
          deliver.ts                    Deliver (Complex) -- core delivery orchestrator
          resolve-recipient.ts          RecipientResolver (Complex) -- contactId to email/phone
        c/
          set-channel-preference.ts     SetChannelPreference (Command) -- upsert channel prefs
        q/
          get-channel-preference.ts     GetChannelPreference (Query) -- read channel prefs
```

## CQRS Handlers

| Handler              | Category | Dir  | Description                                                               |
| -------------------- | -------- | ---- | ------------------------------------------------------------------------- |
| Deliver              | Complex  | `x/` | Full delivery orchestrator: create Message + Request, resolve recipient, pick channels, render markdown, dispatch via providers, handle retries |
| RecipientResolver    | Complex  | `x/` | Resolves contactId to email/phone via `GetContactsByIds` (geo-client)     |
| SetChannelPreference | Command  | `c/` | Upsert per-contact channel preferences (email/sms enabled flags)          |
| GetChannelPreference | Query    | `q/` | Read channel preferences with optional in-memory cache (15min TTL)        |

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

## Provider Interfaces

| Interface       | Input                                              | Output                     |
| --------------- | -------------------------------------------------- | -------------------------- |
| IEmailProvider  | `{ to, subject, html, plainText, replyTo? }`      | `{ providerMessageId }`   |
| ISmsProvider    | `{ to, body }`                                     | `{ providerMessageId }`   |

Both extend `IHandler<TInput, TOutput>` -- they ARE handlers, with full OTel span tracing and redaction support.

## Repository Handler Bundles

| Bundle                         | Handlers                                      |
| ------------------------------ | --------------------------------------------- |
| `MessageRepoHandlers`          | create, findById                              |
| `DeliveryRequestRepoHandlers`  | create, findById, findByCorrelationId, markProcessed |
| `DeliveryAttemptRepoHandlers`  | create, findByRequestId, updateStatus         |
| `ChannelPreferenceRepoHandlers`| create, findByContactId, update               |

## Service Keys (DI)

20 total ServiceKeys split across two categories:

**Infra keys** (interfaces defined in app, implemented in infra): 12 repository handler keys + 2 provider keys

**App keys** (defined and implemented in app): `IDeliverKey`, `IRecipientResolverKey`, `ISetChannelPreferenceKey`, `IGetChannelPreferenceKey`

## Registration

```ts
import { addCommsApp } from "@d2/comms-app";

addCommsApp(services);  // registers all 4 CQRS handlers as transient
```

Requires infra keys to already be registered (called after `addCommsInfra`).

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
```

## Dependencies

| Package                | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `@d2/comms-domain`     | Domain entities, enums, rules                 |
| `@d2/di`               | ServiceKey, ServiceCollection for DI          |
| `@d2/geo-client`       | GetContactsByIds handler type for recipient resolution |
| `@d2/handler`          | BaseHandler, IHandlerContext, zodGuid         |
| `@d2/interfaces`       | InMemoryCache handler types for optional caching |
| `@d2/result`           | D2Result return type                          |
| `@d2/utilities`        | UUIDv7 generation                             |
| `isomorphic-dompurify` | XSS-safe HTML sanitization for email bodies   |
| `marked`               | Markdown to HTML rendering (CommonMark)       |
| `zod`                  | Input validation schemas                      |
