# Messaging Architecture

D2-WORX uses **raw AMQP** with **Protocol Buffer** event contracts for cross-service messaging. No framework envelope (e.g., MassTransit) is used — both .NET and Node.js speak the same wire format.

## Transport

| Concern     | Detail                                              |
| ----------- | --------------------------------------------------- |
| Broker      | RabbitMQ 4.1                                        |
| Protocol    | AMQP 0-9-1                                          |
| .NET client | `RabbitMQ.Client` 7.x (async API)                   |
| Node client | `rabbitmq-client` via `@d2/messaging`                |
| Serialization | Proto canonical JSON (`JsonFormatter`/`JsonParser` on .NET, `toJSON`/`fromJSON` on Node.js) |

## Event Contracts

Event types are defined in **Protocol Buffers** under `contracts/protos/events/v1/`. Both .NET and Node.js generate types from the same `.proto` files:

- **.NET:** `Grpc.Tools` generates into `D2.Events.Protos.V1` namespace
- **Node.js:** `@bufbuild/buf` + `ts-proto` generates into `@d2/protos` package

### Current Events

| Proto File            | Message Type                 | Publisher | Consumers          |
| --------------------- | ---------------------------- | --------- | ------------------ |
| `geo_events.proto`    | `GeoRefDataUpdatedEvent`     | Geo.Infra | Geo.Client, @d2/geo-client |
| `auth_events.proto`   | `SendVerificationEmailEvent` | Auth      | Comms (planned)    |
| `auth_events.proto`   | `SendPasswordResetEvent`     | Auth      | Comms (planned)    |
| `auth_events.proto`   | `SendInvitationEmailEvent`   | Auth      | Comms (planned)    |

## Exchange Naming

| Pattern              | Exchange Type | Example         | Use Case                       |
| -------------------- | ------------- | --------------- | ------------------------------ |
| `events.{service}`   | fanout        | `events.geo`    | Broadcast events to all consumers |
| `commands.{service}` | topic         | `commands.auth` | Directed commands with routing |

Naming convention is enforced by `AmqpConventions.EventExchange()` / `AmqpConventions.CommandExchange()` (.NET) and manual string construction (Node.js).

## Queue Naming

| Pattern                   | Durability         | Use Case                     |
| ------------------------- | ------------------ | ---------------------------- |
| Exclusive + auto-delete   | Per-instance       | Broadcast consumers (each instance gets all events) |
| Durable + shared name     | Survives restarts  | Competing consumers (work queue pattern) |

Broadcast consumers (e.g., cache invalidation via `GeoRefDataUpdatedEvent`) create **exclusive auto-delete queues** so each service instance receives every event. The queue name includes a random instance ID to avoid collisions.

## AMQP Headers

Every published message includes:

| Header          | Value                               | Example                              |
| --------------- | ----------------------------------- | ------------------------------------ |
| `content-type`  | `application/json`                  | `application/json`                   |
| `x-proto-type`  | Fully-qualified proto type name     | `d2.events.v1.GeoRefDataUpdatedEvent` |
| `message-id`    | UUID                                | `a1b2c3d4-...`                       |
| `timestamp`     | Unix epoch (seconds)                | `1707300000`                         |

## Serialization

Messages use **proto canonical JSON** (camelCase field names):

```json
{
  "version": "3.0.0"
}
```

- **.NET:** `JsonFormatter.Default.Format(message)` to serialize, `JsonParser.Default.Parse<T>(json)` to deserialize
- **Node.js:** `EventFns.toJSON(message)` to serialize, `EventFns.fromJSON(raw)` to deserialize (via `ConsumerConfig.deserialize`)

## Error Handling

- **Success:** Message is ACKed automatically
- **Handler failure:** Message is NACKed with requeue (RabbitMQ redelivers)
- **Publish failure:** Wrapped in `D2Result.Fail()` with `ServiceUnavailable` status

## Contract Tests

JSON fixtures in `contracts/fixtures/events/v1/` serve as the single source of truth for cross-language compatibility:

1. Both .NET and Node.js parse the same fixture files
2. Each side validates field values match expectations
3. Each side performs a round-trip (deserialize + serialize + re-deserialize) to verify no data loss

This guarantees that a message published by .NET can be consumed by Node.js and vice versa.

## Architecture: .NET

```
ProtoPublisher          — Generic publisher (serialize + AMQP headers + publish)
ProtoConsumer<T>        — Generic consumer (declare exchange/queue, bind, consume, deserialize)
UpdatePublisher         — Service-specific wrapper (exchange name + D2Result error handling)
UpdatedConsumerService  — BackgroundService hosting ProtoConsumer<T>
```

Registered via `services.AddRabbitMqMessaging(connectionString)` in DI.

## Architecture: Node.js

```
MessageBus              — Thin wrapper around rabbitmq-client (subscribe + publish)
ConsumerConfig<T>       — Config with optional deserialize function for proto types
createUpdatedConsumer() — Factory that wires MessageBus → Updated handler
```

The `deserialize` option on `ConsumerConfig<T>` applies proto `fromJSON` before passing the message to the handler callback.
