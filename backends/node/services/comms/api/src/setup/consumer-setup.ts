import type { ServiceProvider } from "@d2/di";
import { createServiceScope } from "@d2/handler";
import type { ILogger } from "@d2/logging";
import type { MessageBus } from "@d2/messaging";
import { createNotificationConsumer, declareRetryTopology } from "@d2/comms-infra";

/**
 * Declares the RabbitMQ retry topology and starts the notification consumer.
 */
export async function startNotificationConsumer(
  messageBus: MessageBus,
  provider: ServiceProvider,
  logger: ILogger,
): Promise<void> {
  // Declare retry topology (tier queues + requeue exchange) before starting consumer
  await declareRetryTopology(messageBus);
  logger.info("Retry topology declared");

  // Retry publisher for re-publishing failed messages to tier queues
  const retryPublisher = messageBus.createPublisher();

  const consumer = createNotificationConsumer({
    messageBus,
    provider,
    createScope: createServiceScope,
    retryPublisher,
    logger,
  });
  await consumer.ready;
  logger.info("Notification consumer started");
}
