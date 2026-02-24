import type { DeliveryRequest, DeliveryAttempt } from "@d2/comms-domain";
import type { DeliveryRequestDTO, DeliveryAttemptDTO } from "@d2/protos";

export function deliveryRequestToProto(req: DeliveryRequest): DeliveryRequestDTO {
  return {
    id: req.id,
    messageId: req.messageId,
    correlationId: req.correlationId,
    recipientContactId: req.recipientContactId,
    channels: [],
    callbackTopic: req.callbackTopic ?? undefined,
    createdAt: req.createdAt,
    processedAt: req.processedAt ?? undefined,
  };
}

export function deliveryAttemptToProto(attempt: DeliveryAttempt): DeliveryAttemptDTO {
  return {
    id: attempt.id,
    requestId: attempt.requestId,
    channel: attempt.channel,
    recipientAddress: attempt.recipientAddress,
    status: attempt.status,
    providerMessageId: attempt.providerMessageId ?? undefined,
    error: attempt.error ?? undefined,
    attemptNumber: attempt.attemptNumber,
    createdAt: attempt.createdAt,
    nextRetryAt: attempt.nextRetryAt ?? undefined,
  };
}
