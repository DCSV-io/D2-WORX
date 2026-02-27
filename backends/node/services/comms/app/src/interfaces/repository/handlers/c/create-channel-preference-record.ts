import type { IHandler } from "@d2/handler";
import type { ChannelPreference } from "@d2/comms-domain";

export interface CreateChannelPreferenceRecordInput {
  readonly pref: ChannelPreference;
}

export interface CreateChannelPreferenceRecordOutput {}

export type ICreateChannelPreferenceRecordHandler = IHandler<
  CreateChannelPreferenceRecordInput,
  CreateChannelPreferenceRecordOutput
>;
