import type { DeliveryRequest } from "../entities/delivery-request.js";

/**
 * Validates that a delivery request has at least one recipient.
 *
 * Recipients are identified by userId (D2 user) or contactId (external contact).
 * No raw email/phone — Comms resolves contact details via geo-client at processing time.
 */
export function hasValidRecipient(request: DeliveryRequest): boolean {
  return !!request.recipientUserId || !!request.recipientContactId;
}

/**
 * Returns a human-readable description of the recipient for logging/debugging.
 */
export function describeRecipient(request: DeliveryRequest): string {
  if (request.recipientUserId) {
    return `user:${request.recipientUserId}`;
  }
  if (request.recipientContactId) {
    return `contact:${request.recipientContactId}`;
  }
  return "none";
}
