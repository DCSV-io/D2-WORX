import type { MessageBus } from "@d2/messaging";
import type { DeliverySubHandlers } from "@d2/comms-app";
import { COMMS_MESSAGING } from "@d2/comms-domain";
import { AUTH_MESSAGING } from "@d2/auth-domain";
import {
  SendVerificationEmailEventFns,
  SendPasswordResetEventFns,
  SendInvitationEmailEventFns,
} from "@d2/protos";

/**
 * Creates a RabbitMQ consumer for auth service events.
 * Dispatches to the appropriate sub handler based on message shape.
 *
 * Uses a durable shared queue — messages are not lost if consumer crashes.
 * Multiple comms instances compete for messages (competing consumer pattern).
 */
export function createAuthEventConsumer(messageBus: MessageBus, subHandlers: DeliverySubHandlers) {
  return messageBus.subscribe<unknown>(
    {
      queue: COMMS_MESSAGING.AUTH_EVENTS_QUEUE,
      queueOptions: { durable: true },
      exchanges: [{ exchange: AUTH_MESSAGING.EVENTS_EXCHANGE, type: "fanout" }],
      queueBindings: [{ exchange: AUTH_MESSAGING.EVENTS_EXCHANGE, routingKey: "" }],
    },
    async (msg) => {
      const body = msg as Record<string, unknown>;

      // Detect event type by shape (unique fields per event type)
      if ("verificationUrl" in body) {
        const event = SendVerificationEmailEventFns.fromJSON(body);
        await subHandlers.handleVerificationEmail.handleAsync(event);
      } else if ("resetUrl" in body) {
        const event = SendPasswordResetEventFns.fromJSON(body);
        await subHandlers.handlePasswordReset.handleAsync(event);
      } else if ("invitationUrl" in body) {
        const event = SendInvitationEmailEventFns.fromJSON(body);
        await subHandlers.handleInvitationEmail.handleAsync(event);
      }
      // Unknown event types are silently ignored (ACKed) to prevent queue buildup.
      // The BaseHandler logs each invocation, so we get visibility without explicit logging here.
    },
  );
}
