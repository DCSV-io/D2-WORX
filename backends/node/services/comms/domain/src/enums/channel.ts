/**
 * External outbound delivery channels.
 *
 * Only channels that go through an external provider (SendGrid, Twilio, etc.).
 * "push" (SignalR toasts) and "in_app" (notification thread messages) are NOT
 * delivery channels — they are separate mechanisms triggered on message creation.
 */

export const CHANNELS = ["email", "sms"] as const;

export type Channel = (typeof CHANNELS)[number];

export function isValidChannel(value: unknown): value is Channel {
  return typeof value === "string" && CHANNELS.includes(value as Channel);
}
