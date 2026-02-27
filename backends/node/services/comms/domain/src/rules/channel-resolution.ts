import type { Channel } from "../enums/channel.js";
import type { Message } from "../entities/message.js";
import type { ChannelPreference } from "../entities/channel-preference.js";
import type { ResolvedChannels } from "../value-objects/resolved-channels.js";

/**
 * Resolves which channels should receive delivery attempts for a message,
 * given the recipient's preferences and the message's sensitivity/urgency.
 *
 * Resolution rules:
 * 1. `sensitive=true` -> email ONLY (safety: tokens must not leak via SMS)
 * 2. `urgency="urgent"` -> all channels (email + SMS), ignores prefs
 * 3. `urgency="normal"` -> respects all channel preferences
 *
 * @param prefs - Recipient's channel preferences (null = defaults: email+sms enabled)
 * @param message - The message being delivered (reads sensitive + urgency)
 */
export function resolveChannels(
  prefs: ChannelPreference | null,
  message: Pick<Message, "sensitive" | "urgency">,
): ResolvedChannels {
  const emailEnabled = prefs?.emailEnabled ?? true;
  const smsEnabled = prefs?.smsEnabled ?? true;

  const channels: Channel[] = [];
  const skippedChannels: Channel[] = [];

  // --- Sensitive: email only, no other channels ---
  if (message.sensitive) {
    channels.push("email");
    skippedChannels.push("sms");

    return { channels, skippedChannels };
  }

  // --- Urgent: force all channels ---
  if (message.urgency === "urgent") {
    channels.push("email", "sms");

    return { channels, skippedChannels };
  }

  // --- Normal: respect all preferences ---
  if (emailEnabled) channels.push("email");
  else skippedChannels.push("email");

  if (smsEnabled) channels.push("sms");
  else skippedChannels.push("sms");

  return { channels, skippedChannels };
}
