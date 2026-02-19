/**
 * Thread-level notification trigger policy for offline participants.
 *
 * - `all_messages` — every message triggers delivery to offline participants (per their channel prefs)
 * - `mentions_only` — only @mentions trigger delivery
 * - `none` — no delivery; users fetch history manually
 *
 * Per-participant `notificationsMuted` overrides this policy (silences all for that participant).
 * Online participants always see messages via SignalR regardless of policy.
 */

export const NOTIFICATION_POLICIES = ["all_messages", "mentions_only", "none"] as const;

export type NotificationPolicy = (typeof NOTIFICATION_POLICIES)[number];

export function isValidNotificationPolicy(value: unknown): value is NotificationPolicy {
  return typeof value === "string" && NOTIFICATION_POLICIES.includes(value as NotificationPolicy);
}
