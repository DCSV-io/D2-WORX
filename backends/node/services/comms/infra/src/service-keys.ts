// Re-export all service keys from comms-app.
// Keys live alongside interfaces (in comms-app), but infra re-exports
// them for convenience so the composition root can import from either package.
export {
  ICreateMessageRecordKey,
  IFindMessageByIdKey,
  ICreateDeliveryRequestRecordKey,
  IFindDeliveryRequestByIdKey,
  IFindDeliveryRequestByCorrelationIdKey,
  IMarkDeliveryRequestProcessedKey,
  ICreateDeliveryAttemptRecordKey,
  IFindDeliveryAttemptsByRequestIdKey,
  IUpdateDeliveryAttemptStatusKey,
  ICreateChannelPreferenceRecordKey,
  IFindChannelPreferenceByContactIdKey,
  IUpdateChannelPreferenceRecordKey,
  IEmailProviderKey,
  ISmsProviderKey,
} from "@d2/comms-app";
