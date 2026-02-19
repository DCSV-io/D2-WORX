import type { Channel } from "../enums/channel.js";

/**
 * Result of channel resolution — computed, not persisted.
 *
 * Produced by the `resolveChannels` rule after evaluating the message's
 * sensitive/urgency flags against the recipient's channel preferences
 * and quiet hours.
 */
export interface ResolvedChannels {
  /** Channels that will receive delivery attempts. */
  readonly channels: readonly Channel[];
  /** Channels skipped due to preferences or sensitivity restrictions. */
  readonly skippedChannels: readonly Channel[];
  /** Whether the recipient is currently in their quiet hours window. */
  readonly inQuietHours: boolean;
  /** UTC timestamp when quiet hours end (for delayed scheduling). Null if not in quiet hours. */
  readonly quietHoursEndUtc: Date | null;
}

/**
 * Result of the quiet hours check — computed, not persisted.
 */
export interface QuietHoursResult {
  /** Whether the current time falls within the quiet hours window. */
  readonly inQuietHours: boolean;
  /** UTC timestamp when the quiet hours window ends. Null if not in quiet hours. */
  readonly quietHoursEndUtc: Date | null;
}
