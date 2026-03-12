import type { IHandler } from "@d2/handler";
import type { ChannelPreference } from "@d2/comms-domain";

export interface SetChannelPreferenceInput {
  readonly contactId: string;
  readonly emailEnabled?: boolean;
  readonly smsEnabled?: boolean;
}

export interface SetChannelPreferenceOutput {
  readonly pref: ChannelPreference;
}

/** Handler for creating or updating channel preferences. */
export interface ISetChannelPreferenceHandler
  extends IHandler<SetChannelPreferenceInput, SetChannelPreferenceOutput> {}
