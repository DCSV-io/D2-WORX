import { generateUuidV7 } from "@d2/utilities";
import { CommsValidationError } from "../exceptions/comms-validation-error.js";

/**
 * Per-user, per-message read tracking.
 *
 * Used for notification read state (has the user seen this notification?)
 * and optional "seen by" read receipts in threads.
 * UNIQUE(messageId, userId) enforced at the database level.
 *
 * ThreadParticipant.lastReadAt is the cheaper watermark for unread badge counts;
 * MessageReceipt provides per-item granularity.
 */
export interface MessageReceipt {
  readonly id: string;
  readonly messageId: string;
  readonly userId: string;
  readonly readAt: Date;
}

export interface CreateMessageReceiptInput {
  readonly messageId: string;
  readonly userId: string;
  readonly id?: string;
}

/**
 * Creates a message receipt. Immutable — no updates.
 */
export function createMessageReceipt(input: CreateMessageReceiptInput): MessageReceipt {
  if (!input.messageId) {
    throw new CommsValidationError("MessageReceipt", "messageId", input.messageId, "is required.");
  }

  if (!input.userId) {
    throw new CommsValidationError("MessageReceipt", "userId", input.userId, "is required.");
  }

  return {
    id: input.id ?? generateUuidV7(),
    messageId: input.messageId,
    userId: input.userId,
    readAt: new Date(),
  };
}
