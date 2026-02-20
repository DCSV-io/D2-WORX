# @d2/messaging

Thin wrapper around `rabbitmq-client` for pub/sub messaging. Layer 0 — depends only on `rabbitmq-client`.

## Files

| File Name                            | Description                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| [message-bus.ts](src/message-bus.ts) | `MessageBus` class — subscribe (consumer) + createPublisher with auto-reconnect.   |
| [types.ts](src/types.ts)             | Type definitions (`MessageBusOptions`, `ConsumerConfig`, `PublisherConfig`, etc.). |
| [index.ts](src/index.ts)             | Barrel re-export of `MessageBus` + all types.                                      |

## Usage

```typescript
import { MessageBus } from "@d2/messaging";

const bus = new MessageBus({ url: "amqp://localhost" });

// Subscribe to messages
bus.subscribe({
  queue: "geo.ref-data.updated",
  handler: async (msg) => {
    /* process message */
  },
});

// Publish messages
const publisher = bus.createPublisher({ exchange: "geo.events" });
await publisher.publish("ref-data.updated", { version: 42 });
```

## Features

- **Auto-reconnect** — reconnects on connection loss
- **Broker confirms** — publisher confirms for reliable delivery
- **JSON auto-serialization** — messages serialized/deserialized as JSON
- **ACK/NACK semantics** — consumer handlers control message acknowledgment

## .NET Equivalent

Messaging.RabbitMQ — .NET uses a shared `Messaging.RabbitMQ` library with `ProtoPublisher`/`ProtoConsumer<T>` for raw AMQP with proto canonical JSON serialization. Both sides now use the same transport and serialization format.
