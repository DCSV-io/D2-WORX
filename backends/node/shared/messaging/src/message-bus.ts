import { Connection } from "rabbitmq-client";
import type {
  MessageBusOptions,
  ConsumerConfig,
  PublisherConfig,
  PublishTarget,
  IMessageConsumer,
  IMessagePublisher,
} from "./types.js";

/**
 * Thin wrapper around rabbitmq-client providing consumer and publisher abstractions.
 * Replaces MassTransit for both inbound (consume) and outbound (publish) messaging.
 *
 * Features: auto-reconnect, broker confirms, JSON auto-serialization.
 */
export class MessageBus {
  private readonly connection: Connection;

  constructor(options: MessageBusOptions) {
    this.connection = new Connection({
      url: options.url,
      connectionName: options.connectionName,
    });
  }

  /**
   * Subscribe to messages on a queue.
   * Normal return = ACK. Throw = NACK (requeue/dead-letter per RabbitMQ policy).
   */
  subscribe<T>(config: ConsumerConfig, handler: (message: T) => Promise<void>): IMessageConsumer {
    const consumer = this.connection.createConsumer(
      {
        queue: config.queue,
        queueOptions: config.queueOptions,
        qos:
          config.prefetchCount !== undefined ? { prefetchCount: config.prefetchCount } : undefined,
        exchanges: config.exchanges,
        queueBindings: config.queueBindings,
      },
      async (msg) => {
        await handler(msg.body as T);
      },
    );

    return {
      close: () => consumer.close(),
    };
  }

  /** Create a publisher for outbound messages. */
  createPublisher(config?: PublisherConfig): IMessagePublisher {
    const publisher = this.connection.createPublisher({
      confirm: config?.confirm ?? true,
      maxAttempts: config?.maxAttempts ?? 2,
      exchanges: config?.exchanges,
    });

    return {
      send: async <T>(target: PublishTarget, message: T): Promise<void> => {
        await publisher.send({ exchange: target.exchange, routingKey: target.routingKey }, message);
      },
      close: () => publisher.close(),
    };
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}
