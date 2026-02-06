export interface MessageBusOptions {
  url: string;
  connectionName?: string;
}

export interface ConsumerConfig {
  queue: string;
  queueOptions?: { durable?: boolean };
  prefetchCount?: number;
  exchanges?: Array<{ exchange: string; type: "topic" | "direct" | "fanout" }>;
  queueBindings?: Array<{ exchange: string; routingKey: string }>;
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
  close(): Promise<void>;
}

export interface IMessagePublisher {
  send<T>(target: PublishTarget, message: T): Promise<void>;
  close(): Promise<void>;
}
