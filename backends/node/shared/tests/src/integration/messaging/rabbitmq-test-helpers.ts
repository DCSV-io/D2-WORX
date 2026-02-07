import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { MessageBus } from "@d2/messaging";

let container: StartedRabbitMQContainer;
let bus: MessageBus;

export async function startRabbitMQ(): Promise<void> {
  container = await new RabbitMQContainer("rabbitmq:4.1-management").start();
  const url = `amqp://guest:guest@${container.getHost()}:${container.getMappedPort(5672)}`;
  bus = new MessageBus({ url, connectionName: "integration-test" });
  await bus.waitForConnection();
}

export async function stopRabbitMQ(): Promise<void> {
  await bus?.close();
  await container?.stop();
}

export function getBus(): MessageBus {
  return bus;
}

/**
 * Wraps a promise with a timeout to avoid hanging on failure.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}
