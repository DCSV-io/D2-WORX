// @d2/comms-app — CQRS handlers for the Comms service delivery engine.
// Zero infra imports — this package is pure application logic.

import type { IHandlerContext } from "@d2/handler";
import type { ChannelPreference, TemplateWrapper } from "@d2/comms-domain";
import type { InMemoryCache } from "@d2/interfaces";
import type { Queries } from "@d2/geo-client";

// --- Interfaces (Provider Contracts) ---
export type {
  IEmailProvider,
  SendEmailInput,
  SendEmailOutput,
  ISmsProvider,
  SendSmsInput,
  SendSmsOutput,
} from "./interfaces/providers/index.js";

// --- Interfaces (Repository Handler Bundles) ---
export type {
  // Bundle types (used by factory functions + composition root)
  MessageRepoHandlers,
  DeliveryRequestRepoHandlers,
  DeliveryAttemptRepoHandlers,
  ChannelPreferenceRepoHandlers,
  TemplateWrapperRepoHandlers,
  // Individual handler types
  ICreateMessageRecordHandler,
  ICreateDeliveryRequestRecordHandler,
  ICreateDeliveryAttemptRecordHandler,
  ICreateChannelPreferenceRecordHandler,
  ICreateTemplateWrapperRecordHandler,
  IFindMessageByIdHandler,
  IFindDeliveryRequestByIdHandler,
  IFindDeliveryRequestByCorrelationIdHandler,
  IFindDeliveryAttemptsByRequestIdHandler,
  IFindChannelPreferenceByUserIdHandler,
  IFindChannelPreferenceByContactIdHandler,
  IFindTemplateByNameAndChannelHandler,
  IMarkDeliveryRequestProcessedHandler,
  IUpdateDeliveryAttemptStatusHandler,
  IUpdateChannelPreferenceRecordHandler,
  IUpdateTemplateWrapperRecordHandler,
  // Individual I/O types
  CreateMessageRecordInput,
  CreateMessageRecordOutput,
  CreateDeliveryRequestRecordInput,
  CreateDeliveryRequestRecordOutput,
  CreateDeliveryAttemptRecordInput,
  CreateDeliveryAttemptRecordOutput,
  CreateChannelPreferenceRecordInput,
  CreateChannelPreferenceRecordOutput,
  CreateTemplateWrapperRecordInput,
  CreateTemplateWrapperRecordOutput,
  FindMessageByIdInput,
  FindMessageByIdOutput,
  FindDeliveryRequestByIdInput,
  FindDeliveryRequestByIdOutput,
  FindDeliveryRequestByCorrelationIdInput,
  FindDeliveryRequestByCorrelationIdOutput,
  FindDeliveryAttemptsByRequestIdInput,
  FindDeliveryAttemptsByRequestIdOutput,
  FindChannelPreferenceByUserIdInput,
  FindChannelPreferenceByUserIdOutput,
  FindChannelPreferenceByContactIdInput,
  FindChannelPreferenceByContactIdOutput,
  FindTemplateByNameAndChannelInput,
  FindTemplateByNameAndChannelOutput,
  MarkDeliveryRequestProcessedInput,
  MarkDeliveryRequestProcessedOutput,
  UpdateDeliveryAttemptStatusInput,
  UpdateDeliveryAttemptStatusOutput,
  UpdateChannelPreferenceRecordInput,
  UpdateChannelPreferenceRecordOutput,
  UpdateTemplateWrapperRecordInput,
  UpdateTemplateWrapperRecordOutput,
} from "./interfaces/repository/handlers/index.js";

// --- Interfaces (Messaging Sub Handlers) ---
export type {
  DeliverySubHandlers,
  IHandleVerificationEmailHandler,
  HandleVerificationEmailOutput,
  IHandlePasswordResetHandler,
  HandlePasswordResetOutput,
  IHandleInvitationEmailHandler,
  HandleInvitationEmailOutput,
} from "./interfaces/messaging/handlers/sub/index.js";

// --- Complex Handlers ---
export { Deliver } from "./implementations/cqrs/handlers/x/deliver.js";
export type { DeliverInput, DeliverOutput } from "./implementations/cqrs/handlers/x/deliver.js";

export { RecipientResolver } from "./implementations/cqrs/handlers/x/resolve-recipient.js";
export type {
  ResolveRecipientInput,
  ResolveRecipientOutput,
} from "./implementations/cqrs/handlers/x/resolve-recipient.js";

// --- Command Handlers ---
export { SetChannelPreference } from "./implementations/cqrs/handlers/c/set-channel-preference.js";
export type {
  SetChannelPreferenceInput,
  SetChannelPreferenceOutput,
} from "./implementations/cqrs/handlers/c/set-channel-preference.js";

export { UpsertTemplate } from "./implementations/cqrs/handlers/c/upsert-template.js";
export type {
  UpsertTemplateInput,
  UpsertTemplateOutput,
} from "./implementations/cqrs/handlers/c/upsert-template.js";

// --- Query Handlers ---
export { GetChannelPreference } from "./implementations/cqrs/handlers/q/get-channel-preference.js";
export type {
  GetChannelPreferenceInput,
  GetChannelPreferenceOutput,
} from "./implementations/cqrs/handlers/q/get-channel-preference.js";

export { GetTemplate } from "./implementations/cqrs/handlers/q/get-template.js";
export type {
  GetTemplateInput,
  GetTemplateOutput,
} from "./implementations/cqrs/handlers/q/get-template.js";

// --- Messaging Sub Handlers ---
export { HandleVerificationEmail } from "./implementations/messaging/handlers/sub/handle-verification-email.js";
export { HandlePasswordReset } from "./implementations/messaging/handlers/sub/handle-password-reset.js";
export { HandleInvitationEmail } from "./implementations/messaging/handlers/sub/handle-invitation-email.js";

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

import type {
  MessageRepoHandlers,
  DeliveryRequestRepoHandlers,
  DeliveryAttemptRepoHandlers,
  ChannelPreferenceRepoHandlers,
  TemplateWrapperRepoHandlers,
} from "./interfaces/repository/handlers/index.js";
import type { IEmailProvider } from "./interfaces/providers/index.js";
import type { ISmsProvider } from "./interfaces/providers/index.js";
import { Deliver } from "./implementations/cqrs/handlers/x/deliver.js";
import { RecipientResolver } from "./implementations/cqrs/handlers/x/resolve-recipient.js";
import { SetChannelPreference } from "./implementations/cqrs/handlers/c/set-channel-preference.js";
import { GetChannelPreference } from "./implementations/cqrs/handlers/q/get-channel-preference.js";
import { UpsertTemplate } from "./implementations/cqrs/handlers/c/upsert-template.js";
import { GetTemplate } from "./implementations/cqrs/handlers/q/get-template.js";
import { HandleVerificationEmail } from "./implementations/messaging/handlers/sub/handle-verification-email.js";
import { HandlePasswordReset } from "./implementations/messaging/handlers/sub/handle-password-reset.js";
import { HandleInvitationEmail } from "./implementations/messaging/handlers/sub/handle-invitation-email.js";

/** Creates the delivery engine handlers (orchestrator + CRUD). */
export function createDeliveryHandlers(
  repos: {
    message: MessageRepoHandlers;
    request: DeliveryRequestRepoHandlers;
    attempt: DeliveryAttemptRepoHandlers;
    channelPref: ChannelPreferenceRepoHandlers;
    template: TemplateWrapperRepoHandlers;
  },
  providers: { email: IEmailProvider; sms?: ISmsProvider },
  getContactsByExtKeys: Queries.IGetContactsByExtKeysHandler,
  context: IHandlerContext,
  cache?: {
    channelPref?: {
      get: InMemoryCache.IGetHandler<ChannelPreference>;
      set: InMemoryCache.ISetHandler<ChannelPreference>;
    };
    template?: {
      get: InMemoryCache.IGetHandler<TemplateWrapper>;
      set: InMemoryCache.ISetHandler<TemplateWrapper>;
    };
  },
): DeliveryHandlers {
  const recipientResolver = new RecipientResolver(getContactsByExtKeys, context);
  const deliver = new Deliver(repos, providers, recipientResolver, context);

  return {
    deliver,
    resolveRecipient: recipientResolver,
    setChannelPreference: new SetChannelPreference(repos.channelPref, context, cache?.channelPref),
    getChannelPreference: new GetChannelPreference(repos.channelPref, context, cache?.channelPref),
    upsertTemplate: new UpsertTemplate(repos.template, context, cache?.template),
    getTemplate: new GetTemplate(repos.template, context, cache?.template),
  };
}

/** Return type of createDeliveryHandlers. */
export type DeliveryHandlers = {
  deliver: Deliver;
  resolveRecipient: RecipientResolver;
  setChannelPreference: SetChannelPreference;
  getChannelPreference: GetChannelPreference;
  upsertTemplate: UpsertTemplate;
  getTemplate: GetTemplate;
};

/** Creates messaging subscription handlers for auth events. */
export function createDeliverySubHandlers(
  deliver: Deliver,
  context: IHandlerContext,
): DeliverySubHandlers {
  return {
    handleVerificationEmail: new HandleVerificationEmail(deliver, context),
    handlePasswordReset: new HandlePasswordReset(deliver, context),
    handleInvitationEmail: new HandleInvitationEmail(deliver, context),
  };
}

import type { DeliverySubHandlers } from "./interfaces/messaging/handlers/sub/index.js";

// --- DI Registration ---
export { addCommsApp } from "./registration.js";
export {
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
