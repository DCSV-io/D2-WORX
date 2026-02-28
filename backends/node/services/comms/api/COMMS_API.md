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

| Decision                      | Rationale                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createCommsService(config)`  | Single async factory returns `{ server, shutdown }` -- testable composition root                                                                                               |
| Per-RPC DI scope              | Each gRPC call gets a fresh scope with unique traceId + HandlerContext                                                                                                         |
| Per-message DI scope          | RabbitMQ consumer creates a scope per notification message                                                                                                                     |
| Mappers in api layer          | Domain-to-proto conversion lives here, not in domain (keeps domain proto-free)                                                                                                 |
| Conditional infra wiring      | Missing geo/resend/twilio/rabbitmq config logs warnings but does not crash                                                                                                     |
| OTel bootstrap via `--import` | `@d2/service-defaults/register` loaded via Node.js `--import` flag in package.json scripts, not in main.ts — ESM loader hooks must be installed before any application imports |
| Stubs for Phase 2/3 RPCs      | Thread/notification RPCs return UNIMPLEMENTED -- schema ready, handlers pending                                                                                                |

## Package Structure

```
src/
  index.ts                              Public API re-exports (createCommsService, mappers)
  main.ts                               Entry point: env config, createCommsService (OTel via --import)
  composition-root.ts                   createCommsService(config) -- full app wiring
  services/
    comms-grpc-service.ts               createCommsGrpcService(provider) -- CommsServiceServer impl
    comms-jobs-grpc-service.ts          createCommsJobsGrpcService(provider) -- CommsJobServiceServer impl
  mappers/
    channel-preference-mapper.ts        channelPreferenceToProto (domain -> proto)
    delivery-mapper.ts                  deliveryRequestToProto, deliveryAttemptToProto
```

## Composition Root

`createCommsService(config: CommsServiceConfig)` performs the full wiring sequence:

| Step | Action                  | Details                                                                    |
| ---- | ----------------------- | -------------------------------------------------------------------------- |
| 1    | Create singletons       | pg.Pool, ILogger (Pino), service-level HandlerContext                      |
| 2    | Run migrations          | `runMigrations(pool)` via Drizzle migrator                                 |
| 3    | Build ServiceCollection | Logger, HandlerContext (scoped), GetContactsByIds                          |
| 4    | Register layers         | `addCommsInfra(services, db)` then `addCommsApp(services, jobOptions)`     |
| 4b   | Register lock handlers  | AcquireLock + ReleaseLock as singleton instances (shared Redis connection) |
| 5    | Build ServiceProvider   | `services.build()` -- frozen, ready for resolution                         |
| 6    | Start gRPC server       | `grpc.Server` with `CommsServiceService` + `CommsJobServiceService`        |
| 7    | Start RabbitMQ consumer | `declareRetryTopology` then `createNotificationConsumer`                   |

Returns `{ server, shutdown }` where `shutdown()` closes RabbitMQ, disconnects Redis, disposes provider, and ends the pg pool.

### Configuration

| Field               | Env Var                                   | Required | Default |
| ------------------- | ----------------------------------------- | -------- | ------- |
| `databaseUrl`       | `ConnectionStrings__d2_services_comms`    | Yes      | --      |
| `rabbitMqUrl`       | `ConnectionStrings__d2_rabbitmq`          | No       | --      |
| `redisUrl`          | `ConnectionStrings__d2_redis`             | No       | --      |
| `grpcPort`          | `GRPC_PORT`                               | No       | 5200    |
| `resendApiKey`      | `RESEND_API_KEY`                          | No       | --      |
| `resendFromAddress` | `RESEND_FROM_ADDRESS`                     | No       | --      |
| `twilioAccountSid`  | `TWILIO_ACCOUNT_SID`                      | No       | --      |
| `twilioAuthToken`   | `TWILIO_AUTH_TOKEN`                       | No       | --      |
| `twilioPhoneNumber` | `TWILIO_PHONE_NUMBER`                     | No       | --      |
| `geoAddress`        | `GEO_GRPC_ADDRESS`                        | No       | --      |
| `geoApiKey`         | `COMMS_GEO_CLIENT__APIKEY`                | No       | --      |
| `commsApiKeys`      | `COMMS_API_KEYS__<index>`                 | No       | --      |
| `jobOptions`        | `COMMS_APP__DELETEDMESSAGERETENTIONDAYS`  | No       | 90      |
|                     | `COMMS_APP__DELIVERYHISTORYRETENTIONDAYS` | No       | 365     |
|                     | `COMMS_APP__JOBLOCKTTLMS`                 | No       | 300000  |

Job options are only parsed when `COMMS_APP__DELETEDMESSAGERETENTIONDAYS` is set; otherwise `DEFAULT_COMMS_JOB_OPTIONS` from `@d2/comms-app` is used.

## gRPC Service

`createCommsGrpcService(provider)` returns a `CommsServiceServer` implementation. Each RPC creates a DI scope via `createRpcScope`, resolves the appropriate handler, and disposes the scope when done.

### Implemented RPCs (Phase 1 -- Delivery Engine)

| RPC                    | Handler                                                   | Description                      |
| ---------------------- | --------------------------------------------------------- | -------------------------------- |
| `getChannelPreference` | GetChannelPreference                                      | Read per-contact channel prefs   |
| `setChannelPreference` | SetChannelPreference                                      | Upsert per-contact channel prefs |
| `getDeliveryStatus`    | FindDeliveryRequestById + FindDeliveryAttemptsByRequestId | Delivery request + all attempts  |

### Stub RPCs (UNIMPLEMENTED)

| Phase | RPCs                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| --    | `getTemplate`, `upsertTemplate` (templates removed from architecture)                                                                                                                 |
| 2     | `getNotifications`, `markNotificationsRead`                                                                                                                                           |
| 3     | `createThread`, `getThread`, `getThreads`, `postMessage`, `editMessage`, `deleteMessage`, `getThreadMessages`, `addReaction`, `removeReaction`, `addParticipant`, `removeParticipant` |

## gRPC Job Service

`createCommsJobsGrpcService(provider)` returns a `CommsJobServiceServer` implementation. Same per-RPC scope pattern as the main service. Called by Dkron scheduled jobs.

| RPC                    | Handler                 | Description                                       |
| ---------------------- | ----------------------- | ------------------------------------------------- |
| `purgeDeletedMessages` | RunDeletedMessagePurge  | Purge soft-deleted messages past retention        |
| `purgeDeliveryHistory` | RunDeliveryHistoryPurge | Purge delivery requests + attempts past retention |

Each RPC returns a `JobExecutionResponse` containing `result` (D2Result proto), `jobName`, `rowsAffected`, `durationMs`, `lockAcquired`, and `executedAt`. All RPCs require API key authentication (no exempt RPCs on the job service).

## Security — API Key Interceptor

Both `CommsServiceService` and `CommsJobServiceService` require API key authentication via the `x-api-key` metadata header. The `withApiKeyAuth` wrapper from `@d2/service-defaults/grpc` validates the header against a set of valid keys (`COMMS_API_KEYS__0`, `COMMS_API_KEYS__1`, etc.) before delegating to the handler. The main service exempts `checkHealth`; the job service has no exempt RPCs.

| Scenario            | Response          |
| ------------------- | ----------------- |
| Missing `x-api-key` | `UNAUTHENTICATED` |
| Invalid API key     | `UNAUTHENTICATED` |
| Valid API key       | Pass-through      |

Unlike Geo.API's `ApiKeyInterceptor` (which also validates context-key ownership), the Comms usage is simpler -- flat key set, no per-key context-key authorization. The shared `withApiKeyAuth` in `@d2/service-defaults/grpc` mirrors the .NET `ServiceKeyMiddleware` pattern (one key per calling service) but adapted for `@grpc/grpc-js` (which lacks first-class server interceptors), so each handler is wrapped at the service object level.

## Mappers

Proto-to-domain mappers convert domain entities to `@d2/protos` DTOs for gRPC responses.

| Mapper                     | Input Domain Type | Output Proto Type    |
| -------------------------- | ----------------- | -------------------- |
| `channelPreferenceToProto` | ChannelPreference | ChannelPreferenceDTO |
| `deliveryRequestToProto`   | DeliveryRequest   | DeliveryRequestDTO   |
| `deliveryAttemptToProto`   | DeliveryAttempt   | DeliveryAttemptDTO   |

## Tests

All tests are in `@d2/comms-tests` (`backends/node/services/comms/tests/`):

```
src/unit/api/
  comms-grpc-service.test.ts            gRPC service handler tests (mocked DI provider)
  mappers/
    mapper.test.ts                      Proto mapper conversion tests
```

## Dependencies

| Package                 | Purpose                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `@d2/comms-app`         | CQRS handler service keys, CommsJobOptions, lock keys for DI resolution                  |
| `@d2/comms-domain`      | Domain types for mapper inputs                                                           |
| `@d2/comms-infra`       | runMigrations, declareRetryTopology, consumer                                            |
| `@d2/cache-memory`      | MemoryCacheStore for geo-client contact cache                                            |
| `@d2/cache-redis`       | AcquireLock, ReleaseLock, PingCache for distributed locking + health check               |
| `@d2/di`                | ServiceCollection, ServiceProvider, ServiceScope                                         |
| `@d2/geo-client`        | GetContactsByIds, createGeoServiceClient                                                 |
| `@d2/handler`           | HandlerContext, IRequestContext, IHandlerContextKey                                      |
| `@d2/interfaces`        | Cache handler types                                                                      |
| `@d2/logging`           | createLogger, ILoggerKey                                                                 |
| `@d2/messaging`         | MessageBus for RabbitMQ                                                                  |
| `@d2/protos`            | CommsServiceService + CommsJobServiceService definitions, proto DTOs                     |
| `@d2/result`            | D2Result for gRPC response construction                                                  |
| `@d2/result-extensions` | d2ResultToProto conversion                                                               |
| `@d2/service-defaults`  | setupTelemetry (OTel), gRPC utilities (createRpcScope, withTraceContext, withApiKeyAuth) |
| `@grpc/grpc-js`         | gRPC server runtime                                                                      |
| `drizzle-orm`           | Drizzle ORM (passed to addCommsInfra)                                                    |
| `ioredis`               | Redis client for distributed cache + lock handlers                                       |
| `pg`                    | PostgreSQL driver (Pool creation)                                                        |
