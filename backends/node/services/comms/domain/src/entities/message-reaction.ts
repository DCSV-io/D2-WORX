import { cleanStr, generateUuidV7 } from "@d2/utilities";
import { CommsValidationError } from "../exceptions/comms-validation-error.js";
import { THREAD_CONSTRAINTS } from "../constants/comms-constants.js";

/**
 * A reaction on a message. Immutable — no updates.
 *
 * Reactions are typically emoji (e.g., "thumbs_up", "heart") but can be
 * any short string up to MAX_REACTION_LENGTH characters.
 */
export interface MessageReaction {
  readonly id: string;
  readonly messageId: string;
  readonly userId: string;
  readonly reaction: string;
  readonly createdAt: Date;
}

export interface CreateMessageReactionInput {
  readonly messageId: string;
  readonly userId: string;
  readonly reaction: string;
  readonly id?: string;
}

/**
 * Creates a message reaction. Immutable — no updates.
 */
export function createMessageReaction(input: CreateMessageReactionInput): MessageReaction {
  if (!input.messageId) {
    throw new CommsValidationError("MessageReaction", "messageId", input.messageId, "is required.");
  }

  if (!input.userId) {
    throw new CommsValidationError("MessageReaction", "userId", input.userId, "is required.");
  }

  const reaction = cleanStr(input.reaction);
  if (!reaction) {
    throw new CommsValidationError("MessageReaction", "reaction", input.reaction, "is required.");
  }

  if (reaction.length > THREAD_CONSTRAINTS.MAX_REACTION_LENGTH) {
    throw new CommsValidationError(
      "MessageReaction",
      "reaction",
      `(${reaction.length} chars)`,
      `must not exceed ${THREAD_CONSTRAINTS.MAX_REACTION_LENGTH} characters.`,
    );
  }

  return {
    id: input.id ?? generateUuidV7(),
    messageId: input.messageId,
    userId: input.userId,
    reaction,
    createdAt: new Date(),
  };
}
