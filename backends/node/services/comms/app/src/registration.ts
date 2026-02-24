import type { ServiceCollection } from "@d2/di";
import { IHandlerContextKey } from "@d2/handler";
import { IGetContactsByIdsKey } from "@d2/geo-client";
import {
  // Infra keys
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
  // App keys
  IDeliverKey,
  IRecipientResolverKey,
  ISetChannelPreferenceKey,
  IGetChannelPreferenceKey,
} from "./service-keys.js";
import { Deliver } from "./implementations/cqrs/handlers/x/deliver.js";
import { RecipientResolver } from "./implementations/cqrs/handlers/x/resolve-recipient.js";
import { SetChannelPreference } from "./implementations/cqrs/handlers/c/set-channel-preference.js";
import { GetChannelPreference } from "./implementations/cqrs/handlers/q/get-channel-preference.js";

/**
 * Registers comms application-layer services (CQRS handlers)
 * with the DI container. Mirrors .NET's `services.AddCommsApp()` pattern.
 *
 * All CQRS handlers are transient — new instance per resolve.
 */
export function addCommsApp(services: ServiceCollection): void {
  // --- Complex Handlers ---

  services.addTransient(
    IRecipientResolverKey,
    (sp) =>
      new RecipientResolver(sp.resolve(IGetContactsByIdsKey), sp.resolve(IHandlerContextKey)),
  );

  services.addTransient(
    IDeliverKey,
    (sp) =>
      new Deliver(
        {
          message: {
            create: sp.resolve(ICreateMessageRecordKey),
            findById: sp.resolve(IFindMessageByIdKey),
          },
          request: {
            create: sp.resolve(ICreateDeliveryRequestRecordKey),
            findById: sp.resolve(IFindDeliveryRequestByIdKey),
            findByCorrelationId: sp.resolve(IFindDeliveryRequestByCorrelationIdKey),
            markProcessed: sp.resolve(IMarkDeliveryRequestProcessedKey),
          },
          attempt: {
            create: sp.resolve(ICreateDeliveryAttemptRecordKey),
            findByRequestId: sp.resolve(IFindDeliveryAttemptsByRequestIdKey),
            updateStatus: sp.resolve(IUpdateDeliveryAttemptStatusKey),
          },
          channelPref: {
            create: sp.resolve(ICreateChannelPreferenceRecordKey),
            findByContactId: sp.resolve(IFindChannelPreferenceByContactIdKey),
            update: sp.resolve(IUpdateChannelPreferenceRecordKey),
          },
        },
        { email: sp.resolve(IEmailProviderKey), sms: sp.tryResolve(ISmsProviderKey) },
        sp.resolve(IRecipientResolverKey),
        sp.resolve(IHandlerContextKey),
      ),
  );

  // --- Command Handlers ---

  services.addTransient(
    ISetChannelPreferenceKey,
    (sp) =>
      new SetChannelPreference(
        {
          create: sp.resolve(ICreateChannelPreferenceRecordKey),
          findByContactId: sp.resolve(IFindChannelPreferenceByContactIdKey),
          update: sp.resolve(IUpdateChannelPreferenceRecordKey),
        },
        sp.resolve(IHandlerContextKey),
      ),
  );

  // --- Query Handlers ---

  services.addTransient(
    IGetChannelPreferenceKey,
    (sp) =>
      new GetChannelPreference(
        {
          create: sp.resolve(ICreateChannelPreferenceRecordKey),
          findByContactId: sp.resolve(IFindChannelPreferenceByContactIdKey),
          update: sp.resolve(IUpdateChannelPreferenceRecordKey),
        },
        sp.resolve(IHandlerContextKey),
      ),
  );
}
