import { generateUuidV7 } from "@d2/utilities";
import { CommsValidationError } from "../exceptions/comms-validation-error.js";
import { CHANNEL_DEFAULTS } from "../constants/comms-constants.js";

/**
 * Per-contact channel delivery preferences.
 */
export interface ChannelPreference {
  readonly id: string;
  readonly contactId: string;
  readonly emailEnabled: boolean;
  readonly smsEnabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateChannelPreferenceInput {
  readonly id?: string;
  readonly contactId: string;
  readonly emailEnabled?: boolean;
  readonly smsEnabled?: boolean;
}

export interface UpdateChannelPreferenceInput {
  readonly emailEnabled?: boolean;
  readonly smsEnabled?: boolean;
}

/**
 * Creates channel preferences for a contact.
 */
export function createChannelPreference(input: CreateChannelPreferenceInput): ChannelPreference {
  if (!input.contactId) {
    throw new CommsValidationError(
      "ChannelPreference",
      "contactId",
      null,
      "contactId is required.",
    );
  }

  const now = new Date();

  return {
    id: input.id ?? generateUuidV7(),
    contactId: input.contactId,
    emailEnabled: input.emailEnabled ?? CHANNEL_DEFAULTS.EMAIL_ENABLED,
    smsEnabled: input.smsEnabled ?? CHANNEL_DEFAULTS.SMS_ENABLED,
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
  return {
    ...pref,
    emailEnabled: updates.emailEnabled ?? pref.emailEnabled,
    smsEnabled: updates.smsEnabled ?? pref.smsEnabled,
    updatedAt: new Date(),
  };
}
