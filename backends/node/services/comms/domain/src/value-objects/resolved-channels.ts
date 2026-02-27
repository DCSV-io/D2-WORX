import type { Channel } from "../enums/channel.js";

/**
 * Result of channel resolution — computed, not persisted.
 *
 * Produced by the `resolveChannels` rule after evaluating the message's
 * sensitive/urgency flags against the recipient's channel preferences.
 */
export interface ResolvedChannels {
  /** Channels that will receive delivery attempts. */
  readonly channels: readonly Channel[];
  /** Channels skipped due to preferences or sensitivity restrictions. */
  readonly skippedChannels: readonly Channel[];
}
