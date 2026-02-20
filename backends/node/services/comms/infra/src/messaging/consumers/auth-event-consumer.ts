import type { MessageBus } from "@d2/messaging";
import type { DeliverySubHandlers } from "@d2/comms-app";
import {
  SendVerificationEmailEventFns,
  SendPasswordResetEventFns,
} from "@d2/protos";

/**
 * Creates a RabbitMQ consumer for auth service events.
 * Dispatches to the appropriate sub handler based on the x-proto-type header.
 *
 * Uses a durable shared queue — messages are not lost if consumer crashes.
 * Multiple comms instances compete for messages (competing consumer pattern).
 */
export function createAuthEventConsumer(
  messageBus: MessageBus,
  subHandlers: DeliverySubHandlers,
) {
  return messageBus.subscribe<unknown>(
    {
      queue: "comms.auth-events",
      queueOptions: { durable: true },
      exchanges: [{ exchange: "events.auth", type: "fanout" }],
      queueBindings: [{ exchange: "events.auth", routingKey: "" }],
    },
    async (msg) => {
      // The msg is the raw deserialized JSON body.
      // The x-proto-type header is used by the publisher to indicate the event type.
      // Since rabbitmq-client deserializes the full message, we need to detect the type
      // from the message shape (the header is on the AMQP envelope, not the body).
      const body = msg as Record<string, unknown>;

      // Detect event type by shape (verificationUrl vs resetUrl)
      if ("verificationUrl" in body) {
        const event = SendVerificationEmailEventFns.fromJSON(body);
        await subHandlers.handleVerificationEmail.handleAsync(event);
      } else if ("resetUrl" in body) {
        const event = SendPasswordResetEventFns.fromJSON(body);
        await subHandlers.handlePasswordReset.handleAsync(event);
      }
      // Unknown event types are silently ignored (ACKed) to prevent queue buildup.
      // The BaseHandler logs each invocation, so we get visibility without explicit logging here.
    },
  );
}
