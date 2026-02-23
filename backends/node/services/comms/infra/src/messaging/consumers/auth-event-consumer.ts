import type { MessageBus, IMessagePublisher, IncomingMessage } from "@d2/messaging";
import { ConsumerResult } from "@d2/messaging";
import { matchEvent } from "@d2/comms-app";
import type { ILogger } from "@d2/logging";
import type { ServiceProvider, ServiceScope } from "@d2/di";
import { COMMS_MESSAGING, COMMS_RETRY } from "@d2/comms-domain";
import { AUTH_MESSAGING } from "@d2/auth-domain";
import { getRetryTierQueue } from "../retry-topology.js";

export interface AuthEventConsumerDeps {
  messageBus: MessageBus;
  provider: ServiceProvider;
  createScope: (provider: ServiceProvider) => ServiceScope;
  retryPublisher: IMessagePublisher;
  logger: ILogger;
}

/**
 * Creates a RabbitMQ consumer for auth service events with DLX-based retry.
 *
 * Uses the event registry from comms-app to dispatch messages — adding a new
 * event type only requires a new registry entry and sub-handler, no consumer changes.
 *
 * On success: ACK the message.
 * On retryable delivery failure (D2Result with DELIVERY_FAILED): schedule retry via tier queue.
 * On unexpected error (DI failure, serialization crash): schedule retry via tier queue.
 * At max attempts: log and drop.
 *
 * Always returns ACK — retry is via re-publish to tier queues, not NACK/requeue.
 */
export function createAuthEventConsumer(deps: AuthEventConsumerDeps) {
  const { messageBus, provider, createScope, retryPublisher, logger } = deps;

  return messageBus.subscribeEnriched<unknown>(
    {
      queue: COMMS_MESSAGING.AUTH_EVENTS_QUEUE,
      queueOptions: { durable: true },
      exchanges: [{ exchange: AUTH_MESSAGING.EVENTS_EXCHANGE, type: "fanout" }],
      queueBindings: [{ exchange: AUTH_MESSAGING.EVENTS_EXCHANGE, routingKey: "" }],
    },
    async (msg: IncomingMessage<unknown>) => {
      const body = msg.body as Record<string, unknown>;

      // Match event shape against registry
      const registration = matchEvent(body);
      if (!registration) {
        // Unknown event types are silently ignored (ACKed) to prevent queue buildup.
        return ConsumerResult.ACK;
      }

      try {
        const event = registration.deserialize(body);
        const scope = createScope(provider);

        try {
          const handler = scope.resolve(registration.handlerKey);
          const result = await handler.handleAsync(event as never);

          // Check for retryable delivery failure (provider down, SMTP timeout, etc.)
          if (!result.success && result.errorCode === COMMS_RETRY.DELIVERY_FAILED) {
            await scheduleRetry(msg, body, logger, retryPublisher);
          }
          // Non-DELIVERY_FAILED failures (NOT_FOUND, validation, etc.) are terminal — ACK and move on.
        } finally {
          scope.dispose();
        }
      } catch (error) {
        // Truly unexpected errors (DI resolution failure, serialization crash, etc.)
        await scheduleRetry(msg, body, logger, retryPublisher, error);
      }

      return ConsumerResult.ACK;
    },
  );
}

/**
 * Schedules a retry by re-publishing the message to the appropriate tier queue.
 * At max attempts, logs an error and drops the message.
 */
async function scheduleRetry(
  msg: IncomingMessage<unknown>,
  body: Record<string, unknown>,
  logger: ILogger,
  retryPublisher: IMessagePublisher,
  error?: unknown,
): Promise<void> {
  const retryCount = Number(msg.headers[COMMS_RETRY.RETRY_COUNT_HEADER] ?? 0);
  const tierQueue = getRetryTierQueue(retryCount);

  if (tierQueue === null) {
    logger.error("Max retry attempts reached, dropping message", { retryCount, body }, error);
    return;
  }

  logger.warn("Handler failed, scheduling retry", {
    retryCount: retryCount + 1,
    tierQueue,
    error: error instanceof Error ? error.message : String(error ?? "delivery failed"),
  });

  await retryPublisher.send(
    {
      exchange: "",
      routingKey: tierQueue,
      headers: {
        ...msg.headers,
        [COMMS_RETRY.RETRY_COUNT_HEADER]: retryCount + 1,
      },
    },
    body,
  );
}
