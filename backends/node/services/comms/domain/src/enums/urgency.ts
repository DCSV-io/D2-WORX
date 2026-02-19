/**
 * Message urgency level. Controls channel forcing and quiet hours bypass.
 *
 * - `normal` — respects all channel preferences + quiet hours
 * - `important` — forces email delivery (ignores email pref), SMS follows pref, respects quiet hours
 * - `urgent` — forces all channels (email + SMS), bypasses quiet hours
 */

export const URGENCIES = ["normal", "important", "urgent"] as const;

export type Urgency = (typeof URGENCIES)[number];

export function isValidUrgency(value: unknown): value is Urgency {
  return typeof value === "string" && URGENCIES.includes(value as Urgency);
}
