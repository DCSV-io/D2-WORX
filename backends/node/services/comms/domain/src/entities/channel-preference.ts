import { generateUuidV7 } from "@d2/utilities";
import { CommsValidationError } from "../exceptions/comms-validation-error.js";
import { CHANNEL_DEFAULTS } from "../constants/comms-constants.js";

/**
 * Regex for HH:MM time format (00:00 through 23:59).
 */
const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Per-user or per-contact channel delivery preferences.
 *
 * Quiet hours are all-or-nothing: if any quiet hours field is set,
 * all three (start, end, tz) must be provided. Off by default (all null).
 */
export interface ChannelPreference {
  readonly id: string;
  readonly userId: string | null;
  readonly contactId: string | null;
  readonly emailEnabled: boolean;
  readonly smsEnabled: boolean;
  readonly quietHoursStart: string | null;
  readonly quietHoursEnd: string | null;
  readonly quietHoursTz: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateChannelPreferenceInput {
  readonly id?: string;
  readonly userId?: string | null;
  readonly contactId?: string | null;
  readonly emailEnabled?: boolean;
  readonly smsEnabled?: boolean;
  readonly quietHoursStart?: string | null;
  readonly quietHoursEnd?: string | null;
  readonly quietHoursTz?: string | null;
}

export interface UpdateChannelPreferenceInput {
  readonly emailEnabled?: boolean;
  readonly smsEnabled?: boolean;
  readonly quietHoursStart?: string | null;
  readonly quietHoursEnd?: string | null;
  readonly quietHoursTz?: string | null;
}

function validateQuietHours(
  start: string | null | undefined,
  end: string | null | undefined,
  tz: string | null | undefined,
): void {
  const hasStart = start != null;
  const hasEnd = end != null;
  const hasTz = tz != null;

  // All-or-nothing: either all set or all null
  if (hasStart !== hasEnd || hasEnd !== hasTz) {
    throw new CommsValidationError(
      "ChannelPreference",
      "quietHours",
      { start, end, tz },
      "quiet hours start, end, and timezone must all be provided or all be null.",
    );
  }

  if (hasStart && !HH_MM_REGEX.test(start!)) {
    throw new CommsValidationError(
      "ChannelPreference",
      "quietHoursStart",
      start,
      "must be in HH:MM format (00:00–23:59).",
    );
  }

  if (hasEnd && !HH_MM_REGEX.test(end!)) {
    throw new CommsValidationError(
      "ChannelPreference",
      "quietHoursEnd",
      end,
      "must be in HH:MM format (00:00–23:59).",
    );
  }
}

/**
 * Creates channel preferences for a user or contact.
 */
export function createChannelPreference(input: CreateChannelPreferenceInput): ChannelPreference {
  const hasOwner = !!input.userId || !!input.contactId;
  if (!hasOwner) {
    throw new CommsValidationError(
      "ChannelPreference",
      "owner",
      null,
      "at least one of userId or contactId is required.",
    );
  }

  const start = input.quietHoursStart ?? null;
  const end = input.quietHoursEnd ?? null;
  const tz = input.quietHoursTz ?? null;
  validateQuietHours(start, end, tz);

  const now = new Date();

  return {
    id: input.id ?? generateUuidV7(),
    userId: input.userId ?? null,
    contactId: input.contactId ?? null,
    emailEnabled: input.emailEnabled ?? CHANNEL_DEFAULTS.EMAIL_ENABLED,
    smsEnabled: input.smsEnabled ?? CHANNEL_DEFAULTS.SMS_ENABLED,
    quietHoursStart: start,
    quietHoursEnd: end,
    quietHoursTz: tz,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Updates channel preferences. Only provided fields are changed.
 */
export function updateChannelPreference(
  pref: ChannelPreference,
  updates: UpdateChannelPreferenceInput,
): ChannelPreference {
  const start =
    updates.quietHoursStart !== undefined ? updates.quietHoursStart : pref.quietHoursStart;
  const end = updates.quietHoursEnd !== undefined ? updates.quietHoursEnd : pref.quietHoursEnd;
  const tz = updates.quietHoursTz !== undefined ? updates.quietHoursTz : pref.quietHoursTz;
  validateQuietHours(start, end, tz);

  return {
    ...pref,
    emailEnabled: updates.emailEnabled ?? pref.emailEnabled,
    smsEnabled: updates.smsEnabled ?? pref.smsEnabled,
    quietHoursStart: start ?? null,
    quietHoursEnd: end ?? null,
    quietHoursTz: tz ?? null,
    updatedAt: new Date(),
  };
}
