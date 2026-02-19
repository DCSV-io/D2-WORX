import type { Message } from "../entities/message.js";

/**
 * Validates that a message has at least one sender.
 *
 * A message can be sent by a user (senderUserId), an external contact
 * (senderContactId), or a system service (senderService, e.g., "auth", "billing").
 */
export function hasValidSender(message: Message): boolean {
  return !!message.senderUserId || !!message.senderContactId || !!message.senderService;
}
