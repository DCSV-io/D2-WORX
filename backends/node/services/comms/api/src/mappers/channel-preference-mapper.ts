import type { ChannelPreference } from "@d2/comms-domain";
import type { ChannelPreferenceDTO } from "@d2/protos";

export function channelPreferenceToProto(pref: ChannelPreference): ChannelPreferenceDTO {
  return {
    id: pref.id,
    contactId: pref.contactId,
    emailEnabled: pref.emailEnabled,
    smsEnabled: pref.smsEnabled,
    createdAt: pref.createdAt,
    updatedAt: pref.updatedAt,
  };
}
