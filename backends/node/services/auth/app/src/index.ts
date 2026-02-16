// @d2/auth-app — Custom business logic handlers for the Auth service.
// Zero BetterAuth imports — this package is pure application logic.

import type { IHandlerContext } from "@d2/handler";
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

export { RecordSignInOutcome } from "./implementations/cqrs/handlers/c/record-sign-in-outcome.js";
export type {
  RecordSignInOutcomeInput,
  RecordSignInOutcomeOutput,
} from "./implementations/cqrs/handlers/c/record-sign-in-outcome.js";

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
