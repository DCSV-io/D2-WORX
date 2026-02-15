// @d2/auth-app — Custom business logic handlers for the Auth service.
// Zero BetterAuth imports — this package is pure application logic.

import type { IHandlerContext } from "@d2/handler";
import type { SignInEvent } from "@d2/auth-domain";
import type { Commands, Queries, Complex } from "@d2/geo-client";

// --- Interfaces (Repository) ---
export type { ISignInEventRepository } from "./interfaces/repository/sign-in-event-repository.js";
export type { IEmulationConsentRepository } from "./interfaces/repository/emulation-consent-repository.js";
export type { IOrgContactRepository } from "./interfaces/repository/org-contact-repository.js";

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

// --- Factory Functions ---

import type { ISignInEventRepository } from "./interfaces/repository/sign-in-event-repository.js";
import type { IEmulationConsentRepository } from "./interfaces/repository/emulation-consent-repository.js";
import type { IOrgContactRepository } from "./interfaces/repository/org-contact-repository.js";
import type { InMemoryCache } from "@d2/interfaces";
import { RecordSignInEvent } from "./implementations/cqrs/handlers/c/record-sign-in-event.js";
import { GetSignInEvents } from "./implementations/cqrs/handlers/q/get-sign-in-events.js";
import { CreateEmulationConsent } from "./implementations/cqrs/handlers/c/create-emulation-consent.js";
import { RevokeEmulationConsent } from "./implementations/cqrs/handlers/c/revoke-emulation-consent.js";
import { GetActiveConsents } from "./implementations/cqrs/handlers/q/get-active-consents.js";
import { CreateOrgContact } from "./implementations/cqrs/handlers/c/create-org-contact.js";
import { UpdateOrgContactHandler } from "./implementations/cqrs/handlers/c/update-org-contact.js";
import { DeleteOrgContact } from "./implementations/cqrs/handlers/c/delete-org-contact.js";
import { GetOrgContacts } from "./implementations/cqrs/handlers/q/get-org-contacts.js";

/** Creates sign-in event handlers (mirrors .NET AddXxx() pattern). */
export function createSignInEventHandlers(
  repo: ISignInEventRepository,
  context: IHandlerContext,
  memoryCache?: {
    get: InMemoryCache.IGetHandler<{ events: SignInEvent[]; total: number; latestDate: string | null }>;
    set: InMemoryCache.ISetHandler<{ events: SignInEvent[]; total: number; latestDate: string | null }>;
  },
) {
  return {
    record: new RecordSignInEvent(repo, context),
    getByUser: new GetSignInEvents(repo, context, memoryCache),
  };
}

/** Creates emulation consent handlers. */
export function createEmulationConsentHandlers(
  repo: IEmulationConsentRepository,
  context: IHandlerContext,
  checkOrgExists: (orgId: string) => Promise<boolean>,
) {
  return {
    create: new CreateEmulationConsent(repo, context, checkOrgExists),
    revoke: new RevokeEmulationConsent(repo, context),
    getActive: new GetActiveConsents(repo, context),
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
  repo: IOrgContactRepository,
  context: IHandlerContext,
  geo: OrgContactGeoDeps,
) {
  return {
    create: new CreateOrgContact(repo, context, geo.createContacts),
    update: new UpdateOrgContactHandler(repo, context, geo.updateContactsByExtKeys),
    delete: new DeleteOrgContact(repo, context, geo.deleteContactsByExtKeys),
    getByOrg: new GetOrgContacts(repo, context, geo.getContactsByExtKeys),
  };
}
