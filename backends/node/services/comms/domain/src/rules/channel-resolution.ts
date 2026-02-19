import type { Channel } from "../enums/channel.js";
import type { Message } from "../entities/message.js";
import type { ChannelPreference } from "../entities/channel-preference.js";
import type { ResolvedChannels } from "../value-objects/resolved-channels.js";
import { isInQuietHours } from "./quiet-hours.js";

/**
 * Resolves which channels should receive delivery attempts for a message,
 * given the recipient's preferences and the message's sensitivity/urgency.
 *
 * Resolution rules:
 * 1. `sensitive=true` → email ONLY (safety: tokens must not leak via SMS)
 * 2. `urgency="urgent"` → all channels (email + SMS), ignores prefs
 * 3. `urgency="important"` → forces email (ignores email pref), SMS follows pref
 * 4. `urgency="normal"` → respects all channel preferences
 *
 * Quiet hours:
 * - Bypassed when `sensitive=true` OR `urgency="urgent"`
 * - Applied for "normal" and "important" urgency levels
 *
 * @param requestedChannels - Explicitly requested channels, or null for system-decided
 * @param prefs - Recipient's channel preferences (null = defaults: email+sms enabled, no quiet hours)
 * @param message - The message being delivered (reads sensitive + urgency)
 * @param now - Current UTC time (for testability)
 */
export function resolveChannels(
  requestedChannels: readonly Channel[] | null,
  prefs: ChannelPreference | null,
  message: Pick<Message, "sensitive" | "urgency">,
  now?: Date,
): ResolvedChannels {
  const emailEnabled = prefs?.emailEnabled ?? true;
  const smsEnabled = prefs?.smsEnabled ?? true;

  const channels: Channel[] = [];
  const skippedChannels: Channel[] = [];

  // --- Sensitive: email only, no other channels ---
  if (message.sensitive) {
    // Sensitive always gets email regardless of prefs
    channels.push("email");
    skippedChannels.push("sms");

    // Sensitive bypasses quiet hours
    return {
      channels,
      skippedChannels,
      inQuietHours: false,
      quietHoursEndUtc: null,
    };
  }

  // --- Urgent: force all channels, bypass quiet hours ---
  if (message.urgency === "urgent") {
    channels.push("email", "sms");

    return {
      channels,
      skippedChannels,
      inQuietHours: false,
      quietHoursEndUtc: null,
    };
  }

  // --- Important: force email, SMS follows prefs ---
  if (message.urgency === "important") {
    // Email forced regardless of pref
    channels.push("email");

    // SMS still follows preference
    if (smsEnabled) {
      channels.push("sms");
    } else {
      skippedChannels.push("sms");
    }
  } else {
    // --- Normal: respect all preferences ---
    if (requestedChannels) {
      // Caller explicitly requested specific channels — filter by prefs
      for (const ch of requestedChannels) {
        const enabled = ch === "email" ? emailEnabled : smsEnabled;
        if (enabled) {
          channels.push(ch);
        } else {
          skippedChannels.push(ch);
        }
      }
    } else {
      // System-decided: include all enabled channels
      if (emailEnabled) channels.push("email");
      else skippedChannels.push("email");

      if (smsEnabled) channels.push("sms");
      else skippedChannels.push("sms");
    }
  }

  // --- Quiet hours check (normal + important only) ---
  if (prefs?.quietHoursStart && prefs.quietHoursEnd && prefs.quietHoursTz) {
    const quietResult = isInQuietHours(
      prefs.quietHoursStart,
      prefs.quietHoursEnd,
      prefs.quietHoursTz,
      now,
    );

    if (quietResult.inQuietHours) {
      return {
        channels,
        skippedChannels,
        inQuietHours: true,
        quietHoursEndUtc: quietResult.quietHoursEndUtc,
      };
    }
  }

  return {
    channels,
    skippedChannels,
    inQuietHours: false,
    quietHoursEndUtc: null,
  };
}
