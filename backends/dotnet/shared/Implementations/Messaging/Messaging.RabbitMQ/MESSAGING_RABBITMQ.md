# Messaging.RabbitMQ

RabbitMQ implementation of the `IMessageBus` messaging abstraction. Provides protobuf-over-JSON publishing and consuming via raw AMQP, with support for both broadcast (fanout) and competing-consumer (shared queue) patterns.

## Files

| File                                              | Description                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [MessageBus.cs](MessageBus.cs)                    | `IMessageBus` implementation — unified publish/subscribe facade with managed subscriptions.      |
| [ProtoPublisher.cs](ProtoPublisher.cs)            | Singleton publisher — serializes protobuf to JSON, lazily creates a cached channel, tracks declared exchanges. |
| [ProtoConsumer.cs](ProtoConsumer.cs)              | Standalone broadcast consumer factory — creates exclusive auto-delete queues per instance.        |
| [Conventions/AmqpConventions.cs](Conventions/AmqpConventions.cs) | Static naming helpers for exchange names (`events.{service}`, `commands.{service}`).  |
| [Handlers/Q/Ping.cs](Handlers/Q/Ping.cs)         | Health check handler — verifies the RabbitMQ connection is open and reports latency.             |
| [Extensions.cs](Extensions.cs)                    | DI registration (`AddRabbitMqMessaging`) for connection, publisher, message bus, and ping handler. |

## Overview

This package is the sole .NET RabbitMQ adapter. It implements the `IMessageBus` interface from `D2.Shared.Interfaces.Messaging` and provides the building blocks that service-specific publishers and consumers depend on.

All messages are serialized as **proto canonical JSON** (`JsonFormatter`/`JsonParser`), matching the Node.js `@d2/messaging` wire format. This ensures cross-language compatibility — a message published by .NET can be consumed by Node.js and vice versa.

## Architecture

```
                    ┌──────────────────────────┐
                    │       IMessageBus         │  (D2.Shared.Interfaces.Messaging)
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │        MessageBus         │  PublishAsync → delegates to ProtoPublisher
                    │                           │  SubscribeAsync → creates managed channel + consumer
                    │                           │  PingAsync → checks IConnection.IsOpen
                    └────┬───────────────┬─────┘
                         │               │
            ┌────────────▼──┐   ┌────────▼──────────┐
            │ ProtoPublisher │   │ Subscription       │
            │ (singleton)    │   │ (IAsyncDisposable) │
            └───────────────┘   └───────────────────┘
```

Service-specific publishers (e.g., `UpdatePublisher` in Geo.Infra) inject `ProtoPublisher` directly for simple fire-and-forget publishing. The `MessageBus` is used by `BackgroundService` consumers that need the full subscribe lifecycle.

## Key Classes

### MessageBus

Implements `IMessageBus` with three capabilities:

- **SubscribeAsync** — Creates a dedicated channel, declares the fanout exchange and queue, sets prefetch, and wires an `AsyncEventingBasicConsumer`. Returns an `IAsyncDisposable` subscription that cancels the consumer and disposes the channel on teardown.
- **PublishAsync** — Delegates to `ProtoPublisher`.
- **PingAsync** — Returns `IConnection.IsOpen` (no network round-trip).

Queue behavior is controlled by `ConsumerConfig.Broadcast`:

| Mode                   | `Broadcast` | Queue Name                   | Durable | Exclusive | Auto-Delete | Use Case                                 |
| ---------------------- | ----------- | ---------------------------- | ------- | --------- | ----------- | ---------------------------------------- |
| Broadcast              | `true`      | `{exchange}.{instanceId}`    | No      | Yes       | Yes         | Cache invalidation (all instances)       |
| Competing consumer     | `false`     | `{exchange}.shared`          | Yes     | No        | No          | Work queue (one instance processes each) |

Error handling: exceptions in the handler callback result in **NACK without requeue** (`ConsumerResult.Drop`). There is no requeue option — requeuing causes poison message tight loops. If a message needs retry, it should be re-published with a delay (e.g., DLX tiered retry as used by Comms).

### ProtoPublisher

Singleton that lazily creates and caches a single AMQP channel (double-checked locking via `SemaphoreSlim`). On channel failure, the next publish transparently creates a fresh channel.

Each published message includes standard AMQP properties:

| Property       | Value                                          |
| -------------- | ---------------------------------------------- |
| `ContentType`  | `application/json`                             |
| `MessageId`    | New GUID (hex, no hyphens)                     |
| `Timestamp`    | Unix epoch seconds                             |
| `x-proto-type` | Fully-qualified proto descriptor name (header) |

Exchange declarations are tracked in a `HashSet<string>` to avoid redundant `ExchangeDeclareAsync` calls per publish. The set is cleared when the channel is recreated.

### ProtoConsumer\<T\>

A lower-level broadcast consumer factory predating `MessageBus`. Creates an exclusive auto-delete queue with prefetch of 1. On failure, messages are **NACKed with requeue** (unlike `MessageBus` which drops). Used directly by services that need the simpler pre-`IMessageBus` API.

> **Prefer `MessageBus.SubscribeAsync`** for new consumers — it offers configurable prefetch, broadcast vs. competing-consumer modes, and consistent NACK-without-requeue semantics.

### AmqpConventions

Static naming helpers that enforce the project-wide exchange naming convention:

```csharp
AmqpConventions.EventExchange("geo")        // → "events.geo"
AmqpConventions.CommandExchange("auth")      // → "commands.auth"
```

### Ping Handler

A `BaseHandler<H, I, O>` that checks `IConnection.IsOpen` and measures the check latency. Implements `IRead.IPingHandler` from the messaging interfaces. Used by health check endpoints.

## DI Registration

```csharp
// In service Infra Extensions.cs
services.AddRabbitMqMessaging(connectionString);
```

This registers:

| Registration                  | Lifetime  | Description                                          |
| ----------------------------- | --------- | ---------------------------------------------------- |
| `IConnection`                 | Singleton | Shared RabbitMQ connection (async create via factory) |
| `ProtoPublisher`              | Singleton | Cached-channel publisher                             |
| `IMessageBus` → `MessageBus` | Singleton | Unified publish/subscribe facade                     |
| `IRead.IPingHandler` → `Ping`| Transient | Health check handler                                 |

Service-specific publishers and consumers are registered separately in each service's `Extensions.cs`:

```csharp
// Geo.Infra Extensions.cs
services.AddRabbitMqMessaging(messageQueueConnectionString);   // Shared infrastructure
services.AddTransient<UpdatePublisher>();                      // Service-specific publisher
services.AddHostedService<UpdatedConsumerService>();           // BackgroundService consumer
```

## Usage

### Publishing (Service-Specific Publisher)

Service-specific publishers inject `ProtoPublisher` and wrap it with error handling and the correct exchange name:

```csharp
public class UpdatePublisher
{
    private readonly ProtoPublisher r_publisher;

    public async Task<D2Result> PublishAsync(GeoRefDataUpdatedEvent message, CancellationToken ct)
    {
        try
        {
            await r_publisher.PublishAsync(
                AmqpConventions.EventExchange("geo"),
                message,
                ct: ct);

            return D2Result.Ok();
        }
        catch (Exception ex)
        {
            return D2Result.ServiceUnavailable(["Failed to publish message to RabbitMQ."]);
        }
    }
}
```

### Consuming (BackgroundService)

Consumers are hosted as `BackgroundService` instances that subscribe via `IMessageBus`:

```csharp
public class UpdatedConsumerService : BackgroundService
{
    private readonly IMessageBus r_messageBus;
    private readonly IServiceScopeFactory r_scopeFactory;
    private IAsyncDisposable? _subscription;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var instanceId = Guid.NewGuid().ToString("N")[..8];

        _subscription = await r_messageBus.SubscribeAsync<GeoRefDataUpdatedEvent>(
            new ConsumerConfig
            {
                Exchange = AmqpConventions.EventExchange("geo"),
                InstanceId = instanceId,
            },
            async (message, ct) =>
            {
                await using var scope = r_scopeFactory.CreateAsyncScope();
                var handler = scope.ServiceProvider
                    .GetRequiredService<ISubs.IUpdatedHandler>();

                var result = await handler.HandleAsync(message.Body, ct);
                return result.Failed ? ConsumerResult.Drop : ConsumerResult.Ack;
            },
            stoppingToken);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_subscription is not null)
        {
            await _subscription.DisposeAsync();
        }

        await base.StopAsync(cancellationToken);
    }
}
```

## Serialization

Wire format is **proto canonical JSON** (camelCase field names), consistent with the Node.js `@d2/messaging` package:

- **Publish:** `JsonFormatter.Default.Format(message)` → UTF-8 bytes
- **Consume:** `JsonParser.Default.Parse<T>(json)` from UTF-8 bytes

This ensures cross-language compatibility. Contract tests in `contracts/fixtures/events/v1/` verify round-trip fidelity between .NET and Node.js.

## Dependencies

| Package                                              | Purpose                                      |
| ---------------------------------------------------- | -------------------------------------------- |
| `RabbitMQ.Client` 7.x                               | Async AMQP client                            |
| `Google.Protobuf`                                    | Proto JSON serialization (`JsonFormatter`/`JsonParser`) |
| `D2.Shared.Handler` (project ref)                   | `BaseHandler`, `IHandlerContext`             |
| `D2.Shared.Interfaces` (project ref)                | `IMessageBus`, `ConsumerConfig`, `ConsumerResult`, `IncomingMessage<T>` |
| `Microsoft.Extensions.DependencyInjection.Abstractions` | `IServiceCollection` for DI registration  |
| `Microsoft.Extensions.Hosting.Abstractions`          | `BackgroundService` base (used by consumers) |
| `Microsoft.Extensions.Logging.Abstractions`          | `ILogger<T>`                                 |
