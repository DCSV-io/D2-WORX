import type { ChannelPreference } from "@d2/comms-domain";
import type { ChannelPreferenceDTO } from "@d2/protos";

export function channelPreferenceToProto(pref: ChannelPreference): ChannelPreferenceDTO {
  return {
    id: pref.id,
    userId: pref.userId ?? undefined,
    contactId: pref.contactId ?? undefined,
    emailEnabled: pref.emailEnabled,
    smsEnabled: pref.smsEnabled,
    quietHoursStart: pref.quietHoursStart ?? undefined,
    quietHoursEnd: pref.quietHoursEnd ?? undefined,
    quietHoursTz: pref.quietHoursTz ?? undefined,
    createdAt: pref.createdAt,
    updatedAt: pref.updatedAt,
  };
}
