import { generateUuidV7 } from "@d2/utilities";
import { CommsValidationError } from "../exceptions/comms-validation-error.js";

/**
 * Represents the intent to deliver a message to a recipient.
 *
 * References a Message by ID — no content duplication. Recipients are identified
 * by contactId only; Comms resolves actual email/phone via geo-client
 * at processing time.
 */
export interface DeliveryRequest {
  readonly id: string;
  readonly messageId: string;
  readonly correlationId: string;
  readonly recipientContactId: string;
  readonly callbackTopic: string | null;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
}

export interface CreateDeliveryRequestInput {
  readonly messageId: string;
  readonly correlationId: string;
  readonly recipientContactId: string;
  readonly id?: string;
  readonly callbackTopic?: string | null;
}

/**
 * Creates a new delivery request. Validates messageId, correlationId,
 * and recipient presence.
 */
export function createDeliveryRequest(input: CreateDeliveryRequestInput): DeliveryRequest {
  if (!input.messageId) {
    throw new CommsValidationError("DeliveryRequest", "messageId", input.messageId, "is required.");
  }

  if (!input.correlationId) {
    throw new CommsValidationError(
      "DeliveryRequest",
      "correlationId",
      input.correlationId,
      "is required.",
    );
  }

  if (!input.recipientContactId) {
    throw new CommsValidationError(
      "DeliveryRequest",
      "recipientContactId",
      null,
      "recipientContactId is required.",
    );
  }

  return {
    id: input.id ?? generateUuidV7(),
    messageId: input.messageId,
    correlationId: input.correlationId,
    recipientContactId: input.recipientContactId,
    callbackTopic: input.callbackTopic ?? null,
    createdAt: new Date(),
    processedAt: null,
  };
}

/**
 * Marks a delivery request as fully processed (all attempts terminal).
 */
export function markDeliveryRequestProcessed(request: DeliveryRequest): DeliveryRequest {
  return {
    ...request,
    processedAt: new Date(),
  };
}
