import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ServiceCollection } from "@d2/di";
import { IHandlerContextKey } from "@d2/handler";
import {
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
} from "@d2/comms-app";
import { CreateMessageRecord } from "./repository/handlers/c/create-message-record.js";
import { CreateDeliveryRequestRecord } from "./repository/handlers/c/create-delivery-request-record.js";
import { CreateDeliveryAttemptRecord } from "./repository/handlers/c/create-delivery-attempt-record.js";
import { CreateChannelPreferenceRecord } from "./repository/handlers/c/create-channel-preference-record.js";
import { CreateTemplateWrapperRecord } from "./repository/handlers/c/create-template-wrapper-record.js";
import { FindMessageById } from "./repository/handlers/r/find-message-by-id.js";
import { FindDeliveryRequestById } from "./repository/handlers/r/find-delivery-request-by-id.js";
import { FindDeliveryRequestByCorrelationId } from "./repository/handlers/r/find-delivery-request-by-correlation-id.js";
import { FindDeliveryAttemptsByRequestId } from "./repository/handlers/r/find-delivery-attempts-by-request-id.js";
import { FindChannelPreferenceByUserId } from "./repository/handlers/r/find-channel-preference-by-user-id.js";
import { FindChannelPreferenceByContactId } from "./repository/handlers/r/find-channel-preference-by-contact-id.js";
import { FindTemplateByNameAndChannel } from "./repository/handlers/r/find-template-by-name-and-channel.js";
import { MarkDeliveryRequestProcessed } from "./repository/handlers/u/mark-delivery-request-processed.js";
import { UpdateDeliveryAttemptStatus } from "./repository/handlers/u/update-delivery-attempt-status.js";
import { UpdateChannelPreferenceRecord } from "./repository/handlers/u/update-channel-preference-record.js";
import { UpdateTemplateWrapperRecord } from "./repository/handlers/u/update-template-wrapper-record.js";
import { ResendEmailProvider } from "./providers/email/resend/resend-email-provider.js";
import { TwilioSmsProvider } from "./providers/sms/twilio/twilio-sms-provider.js";

export interface CommsInfraConfig {
  resendApiKey?: string;
  resendFromAddress?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

/**
 * Registers comms infrastructure services (repository handlers, providers)
 * with the DI container. Mirrors .NET's `services.AddCommsInfra()` pattern.
 *
 * All repo handlers are transient. Providers are singleton (hold client connections).
 */
export function addCommsInfra(
  services: ServiceCollection,
  db: NodePgDatabase,
  config: CommsInfraConfig,
): void {
  // --- Message Repository ---
  services.addTransient(
    ICreateMessageRecordKey,
    (sp) => new CreateMessageRecord(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindMessageByIdKey,
    (sp) => new FindMessageById(db, sp.resolve(IHandlerContextKey)),
  );

  // --- Delivery Request Repository ---
  services.addTransient(
    ICreateDeliveryRequestRecordKey,
    (sp) => new CreateDeliveryRequestRecord(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindDeliveryRequestByIdKey,
    (sp) => new FindDeliveryRequestById(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindDeliveryRequestByCorrelationIdKey,
    (sp) => new FindDeliveryRequestByCorrelationId(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IMarkDeliveryRequestProcessedKey,
    (sp) => new MarkDeliveryRequestProcessed(db, sp.resolve(IHandlerContextKey)),
  );

  // --- Delivery Attempt Repository ---
  services.addTransient(
    ICreateDeliveryAttemptRecordKey,
    (sp) => new CreateDeliveryAttemptRecord(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindDeliveryAttemptsByRequestIdKey,
    (sp) => new FindDeliveryAttemptsByRequestId(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IUpdateDeliveryAttemptStatusKey,
    (sp) => new UpdateDeliveryAttemptStatus(db, sp.resolve(IHandlerContextKey)),
  );

  // --- Channel Preference Repository ---
  services.addTransient(
    ICreateChannelPreferenceRecordKey,
    (sp) => new CreateChannelPreferenceRecord(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindChannelPreferenceByUserIdKey,
    (sp) => new FindChannelPreferenceByUserId(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindChannelPreferenceByContactIdKey,
    (sp) => new FindChannelPreferenceByContactId(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IUpdateChannelPreferenceRecordKey,
    (sp) => new UpdateChannelPreferenceRecord(db, sp.resolve(IHandlerContextKey)),
  );

  // --- Template Wrapper Repository ---
  services.addTransient(
    ICreateTemplateWrapperRecordKey,
    (sp) => new CreateTemplateWrapperRecord(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindTemplateByNameAndChannelKey,
    (sp) => new FindTemplateByNameAndChannel(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IUpdateTemplateWrapperRecordKey,
    (sp) => new UpdateTemplateWrapperRecord(db, sp.resolve(IHandlerContextKey)),
  );

  // --- Providers (singleton — hold API client connections) ---
  if (config.resendApiKey && config.resendFromAddress) {
    services.addSingleton(
      IEmailProviderKey,
      (sp) =>
        new ResendEmailProvider(
          config.resendApiKey!,
          config.resendFromAddress!,
          sp.resolve(IHandlerContextKey),
        ),
    );
  }

  if (config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber) {
    services.addSingleton(
      ISmsProviderKey,
      (sp) =>
        new TwilioSmsProvider(
          config.twilioAccountSid!,
          config.twilioAuthToken!,
          config.twilioPhoneNumber!,
          sp.resolve(IHandlerContextKey),
        ),
    );
  }
}
