# @d2/comms-api

gRPC server and composition root for the Comms service. Wires all layers (domain, app, infra) into a single runnable application with per-RPC DI scoping, RabbitMQ consumer, and Drizzle migrations.

## Purpose

This is the executable entry point for the Comms service. It:

1. Creates infrastructure singletons (pg.Pool, logger, geo-client)
2. Runs Drizzle migrations
3. Registers all services in the DI container
4. Starts a gRPC server with per-RPC scope isolation
5. Starts a RabbitMQ consumer with DLX retry topology

Consumed directly by Aspire orchestration (`AddJavaScriptApp`) and integration tests.

## Design Decisions

| Decision                         | Rationale                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `createCommsService(config)`     | Single async factory returns `{ server, shutdown }` -- testable composition root   |
| Per-RPC DI scope                 | Each gRPC call gets a fresh scope with unique traceId + HandlerContext              |
| Per-message DI scope             | RabbitMQ consumer creates a scope per notification message                          |
| Mappers in api layer             | Domain-to-proto conversion lives here, not in domain (keeps domain proto-free)     |
| Conditional infra wiring         | Missing geo/resend/twilio/rabbitmq config logs warnings but does not crash          |
| OTel bootstrap in main.ts        | `setupTelemetry` called before any imports to ensure instrumentation hooks early    |
| Stubs for Phase 2/3 RPCs         | Thread/notification RPCs return UNIMPLEMENTED -- schema ready, handlers pending     |

## Package Structure

```
src/
  index.ts                              Public API re-exports (createCommsService, mappers)
  main.ts                               Entry point: OTel setup, env config, createCommsService
  composition-root.ts                   createCommsService(config) -- full app wiring
  services/
    comms-grpc-service.ts               createCommsGrpcService(provider) -- CommsServiceServer impl
  mappers/
    channel-preference-mapper.ts        channelPreferenceToProto (domain -> proto)
    delivery-mapper.ts                  deliveryRequestToProto, deliveryAttemptToProto
```

## Composition Root

`createCommsService(config: CommsServiceConfig)` performs the full wiring sequence:

| Step | Action                                    | Details                                              |
| ---- | ----------------------------------------- | ---------------------------------------------------- |
| 1    | Create singletons                         | pg.Pool, ILogger (Pino), service-level HandlerContext |
| 2    | Run migrations                            | `runMigrations(pool)` via Drizzle migrator           |
| 3    | Build ServiceCollection                   | Logger, HandlerContext (scoped), GetContactsByIds     |
| 4    | Register layers                           | `addCommsInfra(services, db, config)` then `addCommsApp(services)` |
| 5    | Build ServiceProvider                     | `services.build()` -- frozen, ready for resolution   |
| 6    | Start gRPC server                         | `grpc.Server` with `CommsServiceService`             |
| 7    | Start RabbitMQ consumer                   | `declareRetryTopology` then `createNotificationConsumer` |

Returns `{ server, shutdown }` where `shutdown()` closes RabbitMQ, disposes provider, and ends the pg pool.

### Configuration

| Field              | Env Var                                    | Required | Default |
| ------------------ | ------------------------------------------ | -------- | ------- |
| `databaseUrl`      | `ConnectionStrings__d2_services_comms`     | Yes      | --      |
| `rabbitMqUrl`      | `ConnectionStrings__d2_rabbitmq`           | No       | --      |
| `grpcPort`         | `GRPC_PORT`                                | No       | 5200    |
| `resendApiKey`     | `RESEND_API_KEY`                           | No       | --      |
| `resendFromAddress`| `RESEND_FROM_ADDRESS`                      | No       | --      |
| `twilioAccountSid` | `TWILIO_ACCOUNT_SID`                       | No       | --      |
| `twilioAuthToken`  | `TWILIO_AUTH_TOKEN`                        | No       | --      |
| `twilioPhoneNumber`| `TWILIO_PHONE_NUMBER`                      | No       | --      |
| `geoAddress`       | `GEO_GRPC_ADDRESS`                         | No       | --      |
| `geoApiKey`        | `COMMSGEOCLIENTOPTIONS_APIKEY`             | No       | --      |

## gRPC Service

`createCommsGrpcService(provider)` returns a `CommsServiceServer` implementation. Each RPC creates a DI scope via `createRpcScope`, resolves the appropriate handler, and disposes the scope when done.

### Implemented RPCs (Phase 1 -- Delivery Engine)

| RPC                    | Handler                       | Description                                   |
| ---------------------- | ----------------------------- | --------------------------------------------- |
| `getChannelPreference` | GetChannelPreference          | Read per-contact channel prefs                |
| `setChannelPreference` | SetChannelPreference          | Upsert per-contact channel prefs              |
| `getDeliveryStatus`    | FindDeliveryRequestById + FindDeliveryAttemptsByRequestId | Delivery request + all attempts |

### Stub RPCs (UNIMPLEMENTED)

| Phase | RPCs                                                                                          |
| ----- | --------------------------------------------------------------------------------------------- |
| --    | `getTemplate`, `upsertTemplate` (templates removed from architecture)                         |
| 2     | `getNotifications`, `markNotificationsRead`                                                   |
| 3     | `createThread`, `getThread`, `getThreads`, `postMessage`, `editMessage`, `deleteMessage`, `getThreadMessages`, `addReaction`, `removeReaction`, `addParticipant`, `removeParticipant` |

## Mappers

Proto-to-domain mappers convert domain entities to `@d2/protos` DTOs for gRPC responses.

| Mapper                       | Input Domain Type   | Output Proto Type       |
| ---------------------------- | ------------------- | ----------------------- |
| `channelPreferenceToProto`   | ChannelPreference   | ChannelPreferenceDTO    |
| `deliveryRequestToProto`     | DeliveryRequest     | DeliveryRequestDTO      |
| `deliveryAttemptToProto`     | DeliveryAttempt     | DeliveryAttemptDTO      |

## Tests

All tests are in `@d2/comms-tests` (`backends/node/services/comms/tests/`):

```
src/unit/api/
  comms-grpc-service.test.ts            gRPC service handler tests (mocked DI provider)
  mappers/
    mapper.test.ts                      Proto mapper conversion tests
```

## Dependencies

| Package                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `@d2/comms-app`        | CQRS handler service keys for DI resolution    |
| `@d2/comms-domain`     | Domain types for mapper inputs                 |
| `@d2/comms-infra`      | runMigrations, declareRetryTopology, consumer   |
| `@d2/cache-memory`     | MemoryCacheStore for geo-client contact cache  |
| `@d2/di`               | ServiceCollection, ServiceProvider, ServiceScope |
| `@d2/geo-client`       | GetContactsByIds, createGeoServiceClient       |
| `@d2/handler`          | HandlerContext, IRequestContext, IHandlerContextKey |
| `@d2/interfaces`       | Cache handler types                            |
| `@d2/logging`          | createLogger, ILoggerKey                       |
| `@d2/messaging`        | MessageBus for RabbitMQ                        |
| `@d2/protos`           | CommsServiceService definition, proto DTOs     |
| `@d2/result`           | D2Result for gRPC response construction        |
| `@d2/result-extensions`| d2ResultToProto conversion                     |
| `@d2/service-defaults` | setupTelemetry (OTel bootstrap)                |
| `@grpc/grpc-js`        | gRPC server runtime                            |
| `drizzle-orm`          | Drizzle ORM (passed to addCommsInfra)          |
| `pg`                   | PostgreSQL driver (Pool creation)              |
