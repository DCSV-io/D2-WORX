import type { IHandler } from "@d2/handler";
import type { ChannelPreference } from "@d2/comms-domain";

export interface UpdateChannelPreferenceRecordInput {
  readonly pref: ChannelPreference;
}

export interface UpdateChannelPreferenceRecordOutput {}

export type IUpdateChannelPreferenceRecordHandler = IHandler<
  UpdateChannelPreferenceRecordInput,
  UpdateChannelPreferenceRecordOutput
>;
