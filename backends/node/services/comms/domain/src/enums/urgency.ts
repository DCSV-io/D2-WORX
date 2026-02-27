/**
 * Message urgency level. Controls channel forcing behaviour.
 *
 * - `normal` — respects all channel preferences
 * - `urgent` — forces all channels (email + SMS), bypasses preferences
 */

export const URGENCIES = ["normal", "urgent"] as const;

export type Urgency = (typeof URGENCIES)[number];

export function isValidUrgency(value: unknown): value is Urgency {
  return typeof value === "string" && URGENCIES.includes(value as Urgency);
}
