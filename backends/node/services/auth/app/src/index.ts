// @d2/auth-app — Custom business logic handlers for the Auth service.
// Zero BetterAuth imports — this package is pure application logic.

import type { IHandlerContext } from "@d2/handler";
import type { IMessagePublisher } from "@d2/messaging";
import type { SignInEvent } from "@d2/auth-domain";
import type { Commands, Queries, Complex } from "@d2/geo-client";

// --- Interfaces (Repository Handler Bundles) ---
export type {
  // Bundle types (used by factory functions + composition root)
  SignInEventRepoHandlers,
  EmulationConsentRepoHandlers,
  OrgContactRepoHandlers,
  // Individual handler types (used by app-layer handler constructors)
  ICreateSignInEventHandler,
  IFindSignInEventsByUserIdHandler,
  ICountSignInEventsByUserIdHandler,
  IGetLatestSignInEventDateHandler,
  ICreateEmulationConsentRecordHandler,
  IFindEmulationConsentByIdHandler,
  IFindActiveConsentsByUserIdHandler,
  IFindActiveConsentByUserIdAndOrgHandler,
  IRevokeEmulationConsentRecordHandler,
  ICreateOrgContactRecordHandler,
  IFindOrgContactByIdHandler,
  IFindOrgContactsByOrgIdHandler,
  IUpdateOrgContactRecordHandler,
  IDeleteOrgContactRecordHandler,
  // Individual I/O types
  CreateSignInEventInput,
  CreateSignInEventOutput,
  FindSignInEventsByUserIdInput,
  FindSignInEventsByUserIdOutput,
  CountSignInEventsByUserIdInput,
  CountSignInEventsByUserIdOutput,
  GetLatestSignInEventDateInput,
  GetLatestSignInEventDateOutput,
  CreateEmulationConsentRecordInput,
  CreateEmulationConsentRecordOutput,
  FindEmulationConsentByIdInput,
  FindEmulationConsentByIdOutput,
  FindActiveConsentsByUserIdInput,
  FindActiveConsentsByUserIdOutput,
  FindActiveConsentByUserIdAndOrgInput,
  FindActiveConsentByUserIdAndOrgOutput,
  RevokeEmulationConsentRecordInput,
  RevokeEmulationConsentRecordOutput,
  CreateOrgContactRecordInput,
  CreateOrgContactRecordOutput,
  FindOrgContactByIdInput,
  FindOrgContactByIdOutput,
  FindOrgContactsByOrgIdInput,
  FindOrgContactsByOrgIdOutput,
  UpdateOrgContactRecordInput,
  UpdateOrgContactRecordOutput,
  DeleteOrgContactRecordInput,
  DeleteOrgContactRecordOutput,
} from "./interfaces/repository/handlers/index.js";

export type { ISignInThrottleStore } from "./interfaces/repository/sign-in-throttle-store.js";

// --- Interfaces (Messaging Publisher Handlers) ---
export type {
  NotificationPublisherHandlers,
  IPublishVerificationEmailHandler,
  PublishVerificationEmailOutput,
  IPublishPasswordResetHandler,
  PublishPasswordResetOutput,
  IPublishInvitationEmailHandler,
  PublishInvitationEmailOutput,
} from "./interfaces/messaging/handlers/pub/index.js";

// --- Messages (RabbitMQ notification contracts) ---
export type {
  SendVerificationEmail,
  SendPasswordReset,
  SendInvitationEmail,
} from "./messages/index.js";

// --- Command Handlers ---
export { RecordSignInEvent } from "./implementations/cqrs/handlers/c/record-sign-in-event.js";
export type {
  RecordSignInEventInput,
  RecordSignInEventOutput,
} from "./implementations/cqrs/handlers/c/record-sign-in-event.js";

export { CreateEmulationConsent } from "./implementations/cqrs/handlers/c/create-emulation-consent.js";
export type {
  CreateEmulationConsentInput,
  CreateEmulationConsentOutput,
} from "./implementations/cqrs/handlers/c/create-emulation-consent.js";

export { RevokeEmulationConsent } from "./implementations/cqrs/handlers/c/revoke-emulation-consent.js";
export type {
  RevokeEmulationConsentInput,
  RevokeEmulationConsentOutput,
} from "./implementations/cqrs/handlers/c/revoke-emulation-consent.js";

export { CreateOrgContact } from "./implementations/cqrs/handlers/c/create-org-contact.js";
export type {
  ContactInput,
  CreateOrgContactInput,
  CreateOrgContactOutput,
} from "./implementations/cqrs/handlers/c/create-org-contact.js";

export { UpdateOrgContactHandler } from "./implementations/cqrs/handlers/c/update-org-contact.js";
export type {
  UpdateOrgContactHandlerInput,
  UpdateOrgContactOutput,
} from "./implementations/cqrs/handlers/c/update-org-contact.js";

export { DeleteOrgContact } from "./implementations/cqrs/handlers/c/delete-org-contact.js";
export type {
  DeleteOrgContactInput,
  DeleteOrgContactOutput,
} from "./implementations/cqrs/handlers/c/delete-org-contact.js";

export { CreateUserContact } from "./implementations/cqrs/handlers/c/create-user-contact.js";
export type {
  CreateUserContactInput,
  CreateUserContactOutput,
} from "./implementations/cqrs/handlers/c/create-user-contact.js";

export { RecordSignInOutcome } from "./implementations/cqrs/handlers/c/record-sign-in-outcome.js";
export type {
  RecordSignInOutcomeInput,
  RecordSignInOutcomeOutput,
} from "./implementations/cqrs/handlers/c/record-sign-in-outcome.js";

// --- Messaging Publisher Handlers ---
export { PublishVerificationEmail } from "./implementations/messaging/handlers/pub/publish-verification-email.js";
export { PublishPasswordReset } from "./implementations/messaging/handlers/pub/publish-password-reset.js";
export { PublishInvitationEmail } from "./implementations/messaging/handlers/pub/publish-invitation-email.js";

// --- Query Handlers ---
export { GetSignInEvents } from "./implementations/cqrs/handlers/q/get-sign-in-events.js";
export type {
  GetSignInEventsInput,
  GetSignInEventsOutput,
} from "./implementations/cqrs/handlers/q/get-sign-in-events.js";

export { GetActiveConsents } from "./implementations/cqrs/handlers/q/get-active-consents.js";
export type {
  GetActiveConsentsInput,
  GetActiveConsentsOutput,
} from "./implementations/cqrs/handlers/q/get-active-consents.js";

export { GetOrgContacts } from "./implementations/cqrs/handlers/q/get-org-contacts.js";
export type {
  GetOrgContactsInput,
  GetOrgContactsOutput,
  HydratedOrgContact,
} from "./implementations/cqrs/handlers/q/get-org-contacts.js";

export { CheckSignInThrottle } from "./implementations/cqrs/handlers/q/check-sign-in-throttle.js";
export type {
  CheckSignInThrottleInput,
  CheckSignInThrottleOutput,
} from "./implementations/cqrs/handlers/q/check-sign-in-throttle.js";

// --- Factory Functions ---

import type {
  SignInEventRepoHandlers,
  EmulationConsentRepoHandlers,
  OrgContactRepoHandlers,
} from "./interfaces/repository/handlers/index.js";
import type { ISignInThrottleStore } from "./interfaces/repository/sign-in-throttle-store.js";
import type { InMemoryCache } from "@d2/interfaces";
import { RecordSignInEvent } from "./implementations/cqrs/handlers/c/record-sign-in-event.js";
import { GetSignInEvents } from "./implementations/cqrs/handlers/q/get-sign-in-events.js";
import { RecordSignInOutcome } from "./implementations/cqrs/handlers/c/record-sign-in-outcome.js";
import { CheckSignInThrottle } from "./implementations/cqrs/handlers/q/check-sign-in-throttle.js";
import { CreateEmulationConsent } from "./implementations/cqrs/handlers/c/create-emulation-consent.js";
import { RevokeEmulationConsent } from "./implementations/cqrs/handlers/c/revoke-emulation-consent.js";
import { GetActiveConsents } from "./implementations/cqrs/handlers/q/get-active-consents.js";
import { CreateOrgContact } from "./implementations/cqrs/handlers/c/create-org-contact.js";
import { UpdateOrgContactHandler } from "./implementations/cqrs/handlers/c/update-org-contact.js";
import { DeleteOrgContact } from "./implementations/cqrs/handlers/c/delete-org-contact.js";
import { GetOrgContacts } from "./implementations/cqrs/handlers/q/get-org-contacts.js";
import { PublishVerificationEmail } from "./implementations/messaging/handlers/pub/publish-verification-email.js";
import { PublishPasswordReset } from "./implementations/messaging/handlers/pub/publish-password-reset.js";
import { PublishInvitationEmail } from "./implementations/messaging/handlers/pub/publish-invitation-email.js";
import { CreateUserContact } from "./implementations/cqrs/handlers/c/create-user-contact.js";

/** Creates sign-in event handlers (mirrors .NET AddXxx() pattern). */
export function createSignInEventHandlers(
  repo: SignInEventRepoHandlers,
  context: IHandlerContext,
  memoryCache?: {
    get: InMemoryCache.IGetHandler<{
      events: SignInEvent[];
      total: number;
      latestDate: string | null;
    }>;
    set: InMemoryCache.ISetHandler<{
      events: SignInEvent[];
      total: number;
      latestDate: string | null;
    }>;
  },
) {
  return {
    record: new RecordSignInEvent(repo.create, context),
    getByUser: new GetSignInEvents(
      repo.findByUserId,
      repo.countByUserId,
      repo.getLatestEventDate,
      context,
      memoryCache,
    ),
  };
}

/** Creates emulation consent handlers. */
export function createEmulationConsentHandlers(
  repo: EmulationConsentRepoHandlers,
  context: IHandlerContext,
  checkOrgExists: (orgId: string) => Promise<boolean>,
) {
  return {
    create: new CreateEmulationConsent(
      repo.create,
      repo.findActiveByUserIdAndOrg,
      context,
      checkOrgExists,
    ),
    revoke: new RevokeEmulationConsent(repo.findById, repo.revoke, context),
    getActive: new GetActiveConsents(repo.findActiveByUserId, context),
  };
}

/** Geo contact handler dependencies for org contact handlers. */
export interface OrgContactGeoDeps {
  createContacts: Commands.ICreateContactsHandler;
  deleteContactsByExtKeys: Commands.IDeleteContactsByExtKeysHandler;
  updateContactsByExtKeys: Complex.IUpdateContactsByExtKeysHandler;
  getContactsByExtKeys: Queries.IGetContactsByExtKeysHandler;
}

/** Creates org contact handlers. */
export function createOrgContactHandlers(
  repo: OrgContactRepoHandlers,
  context: IHandlerContext,
  geo: OrgContactGeoDeps,
) {
  return {
    create: new CreateOrgContact(repo.create, repo.delete, context, geo.createContacts),
    update: new UpdateOrgContactHandler(
      repo.findById,
      repo.update,
      context,
      geo.updateContactsByExtKeys,
    ),
    delete: new DeleteOrgContact(repo.findById, repo.delete, context, geo.deleteContactsByExtKeys),
    getByOrg: new GetOrgContacts(repo.findByOrgId, context, geo.getContactsByExtKeys),
  };
}

/** Creates sign-in throttle handlers for brute-force protection. */
export function createSignInThrottleHandlers(
  store: ISignInThrottleStore,
  context: IHandlerContext,
  memoryCache?: {
    get: InMemoryCache.IGetHandler<boolean>;
    set: InMemoryCache.ISetHandler<boolean>;
  },
) {
  return {
    check: new CheckSignInThrottle(store, context, memoryCache),
    record: new RecordSignInOutcome(store, context, memoryCache),
  };
}

/** Return type of createSignInThrottleHandlers. */
export type SignInThrottleHandlers = ReturnType<typeof createSignInThrottleHandlers>;

/**
 * Creates notification publisher handlers.
 *
 * When a publisher is provided, verification and password-reset events are
 * published to the `events.auth` RabbitMQ fanout exchange. Without a publisher,
 * handlers log the request and return success (useful for local development).
 *
 * The composition root wires BetterAuth callbacks (sendVerificationEmail,
 * sendResetPassword, sendInvitationEmail) to call these handlers.
 */
export function createNotificationHandlers(
  context: IHandlerContext,
  publisher?: IMessagePublisher,
) {
  return {
    publishVerificationEmail: new PublishVerificationEmail(context, publisher),
    publishPasswordReset: new PublishPasswordReset(context, publisher),
    publishInvitationEmail: new PublishInvitationEmail(context, publisher),
  };
}

/** Return type of createNotificationHandlers. */
export type NotificationHandlers = ReturnType<typeof createNotificationHandlers>;

/** Creates user contact handler for sign-up Geo contact creation. */
export function createUserContactHandler(
  createContacts: Commands.ICreateContactsHandler,
  context: IHandlerContext,
) {
  return new CreateUserContact(createContacts, context);
}

// --- DI Registration ---
export { addAuthApp, type AddAuthAppOptions } from "./registration.js";
export {
  // Infra-layer keys (interfaces defined here, implemented in auth-infra)
  ICreateSignInEventKey,
  IFindSignInEventsByUserIdKey,
  ICountSignInEventsByUserIdKey,
  IGetLatestSignInEventDateKey,
  ICreateEmulationConsentRecordKey,
  IFindEmulationConsentByIdKey,
  IFindActiveConsentsByUserIdKey,
  IFindActiveConsentByUserIdAndOrgKey,
  IRevokeEmulationConsentRecordKey,
  ICreateOrgContactRecordKey,
  IFindOrgContactByIdKey,
  IFindOrgContactsByOrgIdKey,
  IUpdateOrgContactRecordKey,
  IDeleteOrgContactRecordKey,
  ISignInThrottleStoreKey,
  // App-layer keys
  IRecordSignInEventKey,
  IRecordSignInOutcomeKey,
  ICreateEmulationConsentKey,
  IRevokeEmulationConsentKey,
  ICreateOrgContactKey,
  IUpdateOrgContactKey,
  IDeleteOrgContactKey,
  ICreateUserContactKey,
  IGetSignInEventsKey,
  IGetActiveConsentsKey,
  IGetOrgContactsKey,
  ICheckSignInThrottleKey,
  IPublishVerificationEmailKey,
  IPublishPasswordResetKey,
  IPublishInvitationEmailKey,
} from "./service-keys.js";
