# @d2/comms-tests

Test suite for all Comms service packages (`@d2/comms-domain`, `@d2/comms-app`, `@d2/comms-infra`, `@d2/comms-api`). Follows the D2-WORX convention of separating test projects from source packages -- source packages have zero test dependencies.

## Purpose

Validates the full Comms service stack from domain entity factories through gRPC service handlers. Unit tests mock infrastructure boundaries; integration tests use Testcontainers for real PostgreSQL and RabbitMQ instances.

## Design Decisions

| Decision                       | Rationale                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Separate test project          | Source packages have zero test deps -- mirrors .NET Geo.Tests pattern           |
| Testcontainers for integration | Real PG 18 + RabbitMQ containers for accurate behavior validation               |
| Silent logger in test context  | Prevents noise in test output while preserving handler tracing paths            |
| Shared mock handlers           | `mock-handlers.ts` provides reusable `vi.fn()`-based repo/provider stubs        |
| Custom D2Result matchers       | `@d2/testing` setup file registers matchers for all tests                       |
| Table truncation between tests | `cleanAllTables()` truncates all 4 tables with CASCADE between integration runs |

## Test Organization

```
src/
  setup.ts                                  Registers @d2/testing custom matchers
  unit/
    domain/
      constants.test.ts                     RETRY_POLICY, COMMS_MESSAGING, COMMS_RETRY, THREAD_CONSTRAINTS
      enums/
        channel.test.ts                     Channel values + isValidChannel guard
        urgency.test.ts                     Urgency values + isValidUrgency guard
        delivery-status.test.ts             DeliveryStatus values + transitions
        content-format.test.ts              ContentFormat values + guard
        notification-policy.test.ts         NotificationPolicy values + guard
        thread-type.test.ts                 ThreadType values + guard
        thread-state.test.ts                ThreadState values + transitions
        participant-role.test.ts            ParticipantRole values + hierarchy
      exceptions/
        comms-domain-error.test.ts          CommsDomainError construction
        comms-validation-error.test.ts      CommsValidationError structured fields
      entities/
        message.test.ts                     createMessage, editMessage, softDeleteMessage
        delivery-request.test.ts            createDeliveryRequest, markDeliveryRequestProcessed
        delivery-attempt.test.ts            createDeliveryAttempt, transitionDeliveryAttemptStatus
        channel-preference.test.ts          createChannelPreference, updateChannelPreference
        message-receipt.test.ts             createMessageReceipt
        thread.test.ts                      createThread, updateThread, transitionThreadState
        thread-participant.test.ts          create, update, markParticipantLeft
        message-attachment.test.ts          createMessageAttachment
        message-reaction.test.ts            createMessageReaction
      rules/
        channel-resolution.test.ts          resolveChannels (sensitive, urgent, normal paths)
        retry-policy.test.ts                computeRetryDelay, isMaxAttemptsReached, computeNextRetryAt
        thread-permissions.test.ts          canPostMessage, canEditMessage, canDeleteMessage, etc.
    client/
      notify.test.ts                        Notify handler (validation, publish, no-publisher fallback)
    app/
      factories.test.ts                     createDeliveryHandlers factory
      handlers/
        deliver.test.ts                     Deliver handler (idempotency, channel dispatch, retry)
        resolve-recipient.test.ts           RecipientResolver (geo-client mock)
        set-channel-preference.test.ts      SetChannelPreference handler (create/update, validation)
        get-channel-preference.test.ts      GetChannelPreference handler (found, not-found paths)
      helpers/
        mock-handlers.ts                    Reusable vi.fn() mock factories
    infra/
      resend-email-provider.test.ts         ResendEmailProvider (mocked Resend client)
      twilio-sms-provider.test.ts           TwilioSmsProvider (mocked Twilio client)
      retry-topology.test.ts               getRetryTierQueue mapping + declareRetryTopology
    api/
      comms-grpc-service.test.ts            gRPC service handlers (mocked DI provider)
      mappers/
        mapper.test.ts                      channelPreferenceToProto, deliveryRequestToProto, etc.
  integration/
    message-repository.test.ts              Message CRUD against Testcontainers PG
    delivery-request-repository.test.ts     DeliveryRequest CRUD + correlationId idempotency
    delivery-attempt-repository.test.ts     DeliveryAttempt CRUD + status transitions
    deliver-handler.test.ts                 Full Deliver flow (Testcontainers PG + mocked providers)
    notification-consumer.test.ts           RabbitMQ consumer + DLX retry (Testcontainers RabbitMQ)
    helpers/
      postgres-test-helpers.ts              startPostgres, stopPostgres, getDb, cleanAllTables
      rabbitmq-test-helpers.ts              RabbitMQ container lifecycle helpers
      handler-test-helpers.ts               Handler instantiation with test db + context
      test-context.ts                       createTestContext() (silent logger, trace-integration)
```

## Test Counts

| Category    | Files  | Description                                                 |
| ----------- | ------ | ----------------------------------------------------------- |
| Unit/Domain | 23     | Entities, enums, exceptions, rules, constants               |
| Unit/Client | 1      | Notify handler (validation, publish, no-publisher fallback) |
| Unit/App    | 5      | CQRS handlers + factory (mocked repos/providers)            |
| Unit/Infra  | 3      | Providers (mocked clients) + retry topology                 |
| Unit/API    | 2      | gRPC service + proto mappers                                |
| Integration | 5      | Repository CRUD, Deliver flow, RabbitMQ consumer            |
| **Total**   | **39** | **510 tests across 39 test files**                          |

## Key Test Helpers

| Helper                | Location                           | Purpose                                             |
| --------------------- | ---------------------------------- | --------------------------------------------------- |
| `createTestContext()` | `helpers/test-context.ts`          | HandlerContext with silent logger + static trace    |
| `startPostgres()`     | `helpers/postgres-test-helpers.ts` | Spins up PG 18 Testcontainer + runs migrations      |
| `cleanAllTables()`    | `helpers/postgres-test-helpers.ts` | Truncates all 4 tables with CASCADE                 |
| `mock-handlers.ts`    | `unit/app/helpers/`                | Reusable `vi.fn()` mocks for repo/provider handlers |

## Configuration

Vitest config at `comms/tests/vitest.config.ts`:

- **Project name**: `comms-tests`
- **Shared config**: Inherits from `backends/node/vitest.shared.ts`
- **Setup file**: `src/setup.ts` (registers `@d2/testing` custom matchers)

Run all comms tests:

```
pnpm vitest run --project comms-tests
```

## Dependencies

| Package                      | Purpose                                             |
| ---------------------------- | --------------------------------------------------- |
| `@d2/comms-api`              | Composition root + gRPC service under test          |
| `@d2/comms-app`              | CQRS handlers + service keys under test             |
| `@d2/comms-client`           | Notification publisher (consumer test)              |
| `@d2/comms-domain`           | Domain entities, enums, rules under test            |
| `@d2/comms-infra`            | Repository handlers, providers, consumer under test |
| `@d2/di`                     | ServiceCollection for DI in integration tests       |
| `@d2/handler`                | HandlerContext, IRequestContext for test setup      |
| `@d2/logging`                | createLogger (silent mode for tests)                |
| `@d2/messaging`              | MessageBus for RabbitMQ integration tests           |
| `@d2/protos`                 | Proto types for mapper tests                        |
| `@d2/result`                 | D2Result assertions                                 |
| `@d2/result-extensions`      | d2ResultToProto for API tests                       |
| `@d2/testing`                | Custom Vitest matchers for D2Result                 |
| `@d2/utilities`              | UUIDv7 for test data generation                     |
| `@testcontainers/postgresql` | PostgreSQL 18 container for integration tests       |
| `@testcontainers/rabbitmq`   | RabbitMQ container for consumer integration tests   |
| `drizzle-orm`                | ORM for test database operations                    |
| `pg`                         | PostgreSQL driver                                   |
| `resend`                     | Resend types for provider mock tests                |
| `twilio`                     | Twilio types for provider mock tests                |
| `vitest`                     | Test runner                                         |
