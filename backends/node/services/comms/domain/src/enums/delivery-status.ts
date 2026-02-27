/**
 * Status of a delivery attempt through an external channel.
 *
 * State machine:
 * - pending → sent (succeeded, terminal)
 * - pending → failed (failed this try)
 * - failed → retried (successor attempt created, terminal for THIS attempt)
 *
 * "retried" means "I failed, but a successor attempt exists."
 * "failed" with nextRetryAt=null means permanently failed (max attempts or non-retryable).
 */

export const DELIVERY_STATUSES = ["pending", "sent", "failed", "retried"] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export function isValidDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === "string" && DELIVERY_STATUSES.includes(value as DeliveryStatus);
}

/**
 * Valid status transitions for delivery attempts.
 * Terminal states (sent, retried) have no valid transitions.
 */
export const DELIVERY_STATUS_TRANSITIONS: Readonly<
  Record<DeliveryStatus, readonly DeliveryStatus[]>
> = {
  pending: ["sent", "failed"],
  sent: [],
  failed: ["retried"],
  retried: [],
};
