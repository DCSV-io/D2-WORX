import type { IHandler } from "@d2/handler";
import type { ChannelPreference } from "@d2/comms-domain";

export interface FindChannelPreferenceByUserIdInput {
  readonly userId: string;
}

export interface FindChannelPreferenceByUserIdOutput {
  readonly pref: ChannelPreference | null;
}

export type IFindChannelPreferenceByUserIdHandler = IHandler<
  FindChannelPreferenceByUserIdInput,
  FindChannelPreferenceByUserIdOutput
>;
