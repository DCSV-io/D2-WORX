import { generateUuidV7 } from "@d2/utilities";
import type { Channel } from "../enums/channel.js";
import { isValidChannel } from "../enums/channel.js";
import { CommsValidationError } from "../exceptions/comms-validation-error.js";

/**
 * Represents the intent to deliver a message to a recipient.
 *
 * References a Message by ID — no content duplication. Recipients are identified
 * by userId or contactId only; Comms resolves actual email/phone via geo-client
 * at processing time.
 */
export interface DeliveryRequest {
  readonly id: string;
  readonly messageId: string;
  readonly correlationId: string;
  readonly recipientUserId: string | null;
  readonly recipientContactId: string | null;
  readonly channels: readonly Channel[] | null;
  readonly templateName: string | null;
  readonly callbackTopic: string | null;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
}

export interface CreateDeliveryRequestInput {
  readonly messageId: string;
  readonly correlationId: string;
  readonly id?: string;
  readonly recipientUserId?: string | null;
  readonly recipientContactId?: string | null;
  readonly channels?: readonly Channel[] | null;
  readonly templateName?: string | null;
  readonly callbackTopic?: string | null;
}

/**
 * Creates a new delivery request. Validates messageId, correlationId,
 * recipient presence, and channel values.
 */
export function createDeliveryRequest(input: CreateDeliveryRequestInput): DeliveryRequest {
  if (!input.messageId) {
    throw new CommsValidationError(
      "DeliveryRequest",
      "messageId",
      input.messageId,
      "is required.",
    );
  }

  if (!input.correlationId) {
    throw new CommsValidationError(
      "DeliveryRequest",
      "correlationId",
      input.correlationId,
      "is required.",
    );
  }

  // At least one recipient required
  const hasRecipient = !!input.recipientUserId || !!input.recipientContactId;
  if (!hasRecipient) {
    throw new CommsValidationError(
      "DeliveryRequest",
      "recipient",
      null,
      "at least one of recipientUserId or recipientContactId is required.",
    );
  }

  // Validate each channel if provided
  if (input.channels) {
    for (const ch of input.channels) {
      if (!isValidChannel(ch)) {
        throw new CommsValidationError(
          "DeliveryRequest",
          "channels",
          ch,
          "is not a valid channel.",
        );
      }
    }
  }

  return {
    id: input.id ?? generateUuidV7(),
    messageId: input.messageId,
    correlationId: input.correlationId,
    recipientUserId: input.recipientUserId ?? null,
    recipientContactId: input.recipientContactId ?? null,
    channels: input.channels ?? null,
    templateName: input.templateName ?? null,
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
