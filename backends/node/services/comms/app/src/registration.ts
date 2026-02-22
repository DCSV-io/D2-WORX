import type { ServiceCollection } from "@d2/di";
import { IHandlerContextKey } from "@d2/handler";
import { IGetContactsByExtKeysKey } from "@d2/geo-client";
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
  IFindChannelPreferenceByUserIdKey,
  IFindChannelPreferenceByContactIdKey,
  IUpdateChannelPreferenceRecordKey,
  ICreateTemplateWrapperRecordKey,
  IFindTemplateByNameAndChannelKey,
  IUpdateTemplateWrapperRecordKey,
  IEmailProviderKey,
  ISmsProviderKey,
  // App keys
  IDeliverKey,
  IRecipientResolverKey,
  ISetChannelPreferenceKey,
  IUpsertTemplateKey,
  IGetChannelPreferenceKey,
  IGetTemplateKey,
  IHandleVerificationEmailKey,
  IHandlePasswordResetKey,
  IHandleInvitationEmailKey,
} from "./service-keys.js";
import { Deliver } from "./implementations/cqrs/handlers/x/deliver.js";
import { RecipientResolver } from "./implementations/cqrs/handlers/x/resolve-recipient.js";
import { SetChannelPreference } from "./implementations/cqrs/handlers/c/set-channel-preference.js";
import { UpsertTemplate } from "./implementations/cqrs/handlers/c/upsert-template.js";
import { GetChannelPreference } from "./implementations/cqrs/handlers/q/get-channel-preference.js";
import { GetTemplate } from "./implementations/cqrs/handlers/q/get-template.js";
import { HandleVerificationEmail } from "./implementations/messaging/handlers/sub/handle-verification-email.js";
import { HandlePasswordReset } from "./implementations/messaging/handlers/sub/handle-password-reset.js";
import { HandleInvitationEmail } from "./implementations/messaging/handlers/sub/handle-invitation-email.js";

/**
 * Registers comms application-layer services (CQRS handlers, sub handlers)
 * with the DI container. Mirrors .NET's `services.AddCommsApp()` pattern.
 *
 * All CQRS handlers are transient — new instance per resolve.
 */
export function addCommsApp(services: ServiceCollection): void {
  // --- Complex Handlers ---

  services.addTransient(
    IRecipientResolverKey,
    (sp) =>
      new RecipientResolver(sp.resolve(IGetContactsByExtKeysKey), sp.resolve(IHandlerContextKey)),
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
            findByUserId: sp.resolve(IFindChannelPreferenceByUserIdKey),
            findByContactId: sp.resolve(IFindChannelPreferenceByContactIdKey),
            update: sp.resolve(IUpdateChannelPreferenceRecordKey),
          },
          template: {
            create: sp.resolve(ICreateTemplateWrapperRecordKey),
            findByNameAndChannel: sp.resolve(IFindTemplateByNameAndChannelKey),
            update: sp.resolve(IUpdateTemplateWrapperRecordKey),
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
          findByUserId: sp.resolve(IFindChannelPreferenceByUserIdKey),
          findByContactId: sp.resolve(IFindChannelPreferenceByContactIdKey),
          update: sp.resolve(IUpdateChannelPreferenceRecordKey),
        },
        sp.resolve(IHandlerContextKey),
      ),
  );

  services.addTransient(
    IUpsertTemplateKey,
    (sp) =>
      new UpsertTemplate(
        {
          create: sp.resolve(ICreateTemplateWrapperRecordKey),
          findByNameAndChannel: sp.resolve(IFindTemplateByNameAndChannelKey),
          update: sp.resolve(IUpdateTemplateWrapperRecordKey),
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
          findByUserId: sp.resolve(IFindChannelPreferenceByUserIdKey),
          findByContactId: sp.resolve(IFindChannelPreferenceByContactIdKey),
          update: sp.resolve(IUpdateChannelPreferenceRecordKey),
        },
        sp.resolve(IHandlerContextKey),
      ),
  );

  services.addTransient(
    IGetTemplateKey,
    (sp) =>
      new GetTemplate(
        {
          create: sp.resolve(ICreateTemplateWrapperRecordKey),
          findByNameAndChannel: sp.resolve(IFindTemplateByNameAndChannelKey),
          update: sp.resolve(IUpdateTemplateWrapperRecordKey),
        },
        sp.resolve(IHandlerContextKey),
      ),
  );

  // --- Messaging Sub Handlers ---

  services.addTransient(
    IHandleVerificationEmailKey,
    (sp) => new HandleVerificationEmail(sp.resolve(IDeliverKey), sp.resolve(IHandlerContextKey)),
  );

  services.addTransient(
    IHandlePasswordResetKey,
    (sp) => new HandlePasswordReset(sp.resolve(IDeliverKey), sp.resolve(IHandlerContextKey)),
  );

  services.addTransient(
    IHandleInvitationEmailKey,
    (sp) => new HandleInvitationEmail(sp.resolve(IDeliverKey), sp.resolve(IHandlerContextKey)),
  );
}
