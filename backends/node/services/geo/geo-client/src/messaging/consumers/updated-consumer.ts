import type { ILogger } from "@d2/logging";
import type { MessageBus, ConsumerConfig, IMessageConsumer } from "@d2/messaging";
import type { GeoRefDataUpdated } from "../../messages/geo-ref-data-updated.js";
import type { Updated } from "../handlers/sub/updated.js";

/**
 * Consumer bridge for GeoRefDataUpdated messages.
 * Creates a RabbitMQ consumer that delegates to the Updated handler.
 *
 * Throw on handler failure -> rabbitmq-client nacks with requeue (retry semantics match MassTransit).
 *
 * Mirrors D2.Geo.Client.Messaging.MT.Consumers.UpdatedConsumer in .NET.
 */
export function createUpdatedConsumer(
  bus: MessageBus,
  config: ConsumerConfig,
  handlerFactory: () => Updated,
  logger: ILogger,
): IMessageConsumer {
  return bus.subscribe<GeoRefDataUpdated>(config, async (message) => {
    logger.info(`Received GeoRefDataUpdated message for version ${message.version}`);

    const handler = handlerFactory();
    const result = await handler.handleAsync(message);

    if (result.failed) {
      logger.error(`Failed to process GeoRefDataUpdated message for version ${message.version}`);
      throw new Error(`Failed to process GeoRefDataUpdated message for version ${message.version}`);
    }

    logger.info(`Successfully processed GeoRefDataUpdated message for version ${message.version}`);
  });
}
