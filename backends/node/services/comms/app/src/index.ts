// @d2/comms-app — CQRS handlers for the Comms service delivery engine.
// Zero infra imports — this package is pure application logic.

import type { IHandlerContext } from "@d2/handler";
import type { ChannelPreference } from "@d2/comms-domain";
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
  // Individual handler types
  ICreateMessageRecordHandler,
  ICreateDeliveryRequestRecordHandler,
  ICreateDeliveryAttemptRecordHandler,
  ICreateChannelPreferenceRecordHandler,
  IFindMessageByIdHandler,
  IFindDeliveryRequestByIdHandler,
  IFindDeliveryRequestByCorrelationIdHandler,
  IFindDeliveryAttemptsByRequestIdHandler,
  IFindChannelPreferenceByContactIdHandler,
  IMarkDeliveryRequestProcessedHandler,
  IUpdateDeliveryAttemptStatusHandler,
  IUpdateChannelPreferenceRecordHandler,
  // Individual I/O types
  CreateMessageRecordInput,
  CreateMessageRecordOutput,
  CreateDeliveryRequestRecordInput,
  CreateDeliveryRequestRecordOutput,
  CreateDeliveryAttemptRecordInput,
  CreateDeliveryAttemptRecordOutput,
  CreateChannelPreferenceRecordInput,
  CreateChannelPreferenceRecordOutput,
  FindMessageByIdInput,
  FindMessageByIdOutput,
  FindDeliveryRequestByIdInput,
  FindDeliveryRequestByIdOutput,
  FindDeliveryRequestByCorrelationIdInput,
  FindDeliveryRequestByCorrelationIdOutput,
  FindDeliveryAttemptsByRequestIdInput,
  FindDeliveryAttemptsByRequestIdOutput,
  FindChannelPreferenceByContactIdInput,
  FindChannelPreferenceByContactIdOutput,
  MarkDeliveryRequestProcessedInput,
  MarkDeliveryRequestProcessedOutput,
  UpdateDeliveryAttemptStatusInput,
  UpdateDeliveryAttemptStatusOutput,
  UpdateChannelPreferenceRecordInput,
  UpdateChannelPreferenceRecordOutput,
} from "./interfaces/repository/handlers/index.js";

// --- Complex Handlers ---
export { Deliver } from "./implementations/cqrs/handlers/x/deliver.js";
export type {
  DeliverInput,
  DeliverOutput,
  EmailWrapperOptions,
} from "./implementations/cqrs/handlers/x/deliver.js";

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

// --- Query Handlers ---
export { GetChannelPreference } from "./implementations/cqrs/handlers/q/get-channel-preference.js";
export type {
  GetChannelPreferenceInput,
  GetChannelPreferenceOutput,
} from "./implementations/cqrs/handlers/q/get-channel-preference.js";

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

import type {
  MessageRepoHandlers,
  DeliveryRequestRepoHandlers,
  DeliveryAttemptRepoHandlers,
  ChannelPreferenceRepoHandlers,
} from "./interfaces/repository/handlers/index.js";
import type { IEmailProvider } from "./interfaces/providers/index.js";
import type { ISmsProvider } from "./interfaces/providers/index.js";
import { Deliver } from "./implementations/cqrs/handlers/x/deliver.js";
import type { EmailWrapperOptions } from "./implementations/cqrs/handlers/x/deliver.js";
import { RecipientResolver } from "./implementations/cqrs/handlers/x/resolve-recipient.js";
import { SetChannelPreference } from "./implementations/cqrs/handlers/c/set-channel-preference.js";
import { GetChannelPreference } from "./implementations/cqrs/handlers/q/get-channel-preference.js";

/** Creates the delivery engine handlers (orchestrator + CRUD). */
export function createDeliveryHandlers(
  repos: {
    message: MessageRepoHandlers;
    request: DeliveryRequestRepoHandlers;
    attempt: DeliveryAttemptRepoHandlers;
    channelPref: ChannelPreferenceRepoHandlers;
  },
  providers: { email: IEmailProvider; sms?: ISmsProvider },
  getContactsByIds: Queries.IGetContactsByIdsHandler,
  context: IHandlerContext,
  cache?: {
    channelPref?: {
      get: InMemoryCache.IGetHandler<ChannelPreference>;
      set: InMemoryCache.ISetHandler<ChannelPreference>;
    };
  },
  options?: EmailWrapperOptions,
): DeliveryHandlers {
  const recipientResolver = new RecipientResolver(getContactsByIds, context);
  const deliver = new Deliver(repos, providers, recipientResolver, context, options);

  return {
    deliver,
    resolveRecipient: recipientResolver,
    setChannelPreference: new SetChannelPreference(repos.channelPref, context, cache?.channelPref),
    getChannelPreference: new GetChannelPreference(repos.channelPref, context, cache?.channelPref),
  };
}

/** Return type of createDeliveryHandlers. */
export type DeliveryHandlers = {
  deliver: Deliver;
  resolveRecipient: RecipientResolver;
  setChannelPreference: SetChannelPreference;
  getChannelPreference: GetChannelPreference;
};

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
