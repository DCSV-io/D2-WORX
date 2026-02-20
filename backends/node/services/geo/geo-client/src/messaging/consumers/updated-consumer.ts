import type { ILogger } from "@d2/logging";
import type { MessageBus, ConsumerConfig, IMessageConsumer } from "@d2/messaging";
import type { GeoRefDataUpdatedEvent } from "@d2/protos";
import { GeoRefDataUpdatedEventFns } from "@d2/protos";
import type { Updated } from "../handlers/sub/updated.js";

/**
 * Consumer bridge for GeoRefDataUpdated events.
 * Creates a RabbitMQ consumer that delegates to the Updated handler.
 *
 * Throw on handler failure -> rabbitmq-client nacks with requeue.
 *
 * Mirrors D2.Geo.Client.Messaging.Consumers.UpdatedConsumerService in .NET.
 */
export function createUpdatedConsumer(
  bus: MessageBus,
  config: ConsumerConfig<GeoRefDataUpdatedEvent>,
  handlerFactory: () => Updated,
  logger: ILogger,
): IMessageConsumer {
  return bus.subscribe<GeoRefDataUpdatedEvent>(
    { ...config, deserialize: GeoRefDataUpdatedEventFns.fromJSON },
    async (message) => {
      logger.info(`Received GeoRefDataUpdated event for version ${message.version}`);

      const handler = handlerFactory();
      const result = await handler.handleAsync(message);

      if (result.failed) {
        logger.error(`Failed to process GeoRefDataUpdated event for version ${message.version}`);
        throw new Error(
          `Failed to process GeoRefDataUpdated event for version ${message.version}`,
        );
      }

      logger.info(
        `Successfully processed GeoRefDataUpdated event for version ${message.version}`,
      );
    },
  );
}
