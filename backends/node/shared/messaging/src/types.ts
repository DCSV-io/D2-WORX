export interface MessageBusOptions {
  url: string;
  connectionName?: string;
}

export interface ConsumerConfig<T = unknown> {
  queue: string;
  queueOptions?: { durable?: boolean };
  prefetchCount?: number;
  exchanges?: Array<{ exchange: string; type: "topic" | "direct" | "fanout" }>;
  queueBindings?: Array<{ exchange: string; routingKey: string }>;
  /** Optional deserializer for the raw message body. When provided, the raw JSON is passed through this function before reaching the handler. */
  deserialize?: (raw: unknown) => T;
}

export interface PublisherConfig {
  confirm?: boolean;
  maxAttempts?: number;
  exchanges?: Array<{ exchange: string; type: "topic" | "direct" | "fanout" }>;
}

export interface PublishTarget {
  exchange: string;
  routingKey: string;
}

export interface IMessageConsumer {
  /** Resolves when the consumer is fully set up (queue declared, bindings created, consuming). */
  ready: Promise<void>;
  close(): Promise<void>;
}

export interface IMessagePublisher {
  send<T>(target: PublishTarget, message: T): Promise<void>;
  close(): Promise<void>;
}
