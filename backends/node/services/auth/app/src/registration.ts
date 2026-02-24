import type { ServiceCollection } from "@d2/di";
import { IHandlerContextKey } from "@d2/handler";
import {
  ICreateContactsKey,
  IDeleteContactsByExtKeysKey,
  IGetContactsByExtKeysKey,
  IUpdateContactsByExtKeysKey,
} from "@d2/geo-client";
import {
  // Infra keys (interfaces defined here, implemented in auth-infra)
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
  // App keys
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
} from "./service-keys.js";
import { RecordSignInEvent } from "./implementations/cqrs/handlers/c/record-sign-in-event.js";
import { RecordSignInOutcome } from "./implementations/cqrs/handlers/c/record-sign-in-outcome.js";
import { CreateEmulationConsent } from "./implementations/cqrs/handlers/c/create-emulation-consent.js";
import { RevokeEmulationConsent } from "./implementations/cqrs/handlers/c/revoke-emulation-consent.js";
import { CreateOrgContact } from "./implementations/cqrs/handlers/c/create-org-contact.js";
import { UpdateOrgContactHandler } from "./implementations/cqrs/handlers/c/update-org-contact.js";
import { DeleteOrgContact } from "./implementations/cqrs/handlers/c/delete-org-contact.js";
import { CreateUserContact } from "./implementations/cqrs/handlers/c/create-user-contact.js";
import { GetSignInEvents } from "./implementations/cqrs/handlers/q/get-sign-in-events.js";
import { GetActiveConsents } from "./implementations/cqrs/handlers/q/get-active-consents.js";
import { GetOrgContacts } from "./implementations/cqrs/handlers/q/get-org-contacts.js";
import { CheckSignInThrottle } from "./implementations/cqrs/handlers/q/check-sign-in-throttle.js";
export interface AddAuthAppOptions {
  checkOrgExists: (orgId: string) => Promise<boolean>;
}

/**
 * Registers auth application-layer services (CQRS handlers, notification publishers)
 * with the DI container. Mirrors .NET's `services.AddAuthApp()` pattern.
 *
 * All CQRS handlers are transient — new instance per resolve.
 */
export function addAuthApp(services: ServiceCollection, options: AddAuthAppOptions): void {
  // --- Command Handlers ---

  services.addTransient(
    IRecordSignInEventKey,
    (sp) =>
      new RecordSignInEvent(sp.resolve(ICreateSignInEventKey), sp.resolve(IHandlerContextKey)),
  );

  services.addTransient(
    IRecordSignInOutcomeKey,
    (sp) =>
      new RecordSignInOutcome(sp.resolve(ISignInThrottleStoreKey), sp.resolve(IHandlerContextKey)),
  );

  services.addTransient(
    ICreateEmulationConsentKey,
    (sp) =>
      new CreateEmulationConsent(
        sp.resolve(ICreateEmulationConsentRecordKey),
        sp.resolve(IFindActiveConsentByUserIdAndOrgKey),
        sp.resolve(IHandlerContextKey),
        options.checkOrgExists,
      ),
  );

  services.addTransient(
    IRevokeEmulationConsentKey,
    (sp) =>
      new RevokeEmulationConsent(
        sp.resolve(IFindEmulationConsentByIdKey),
        sp.resolve(IRevokeEmulationConsentRecordKey),
        sp.resolve(IHandlerContextKey),
      ),
  );

  services.addTransient(
    ICreateOrgContactKey,
    (sp) =>
      new CreateOrgContact(
        sp.resolve(ICreateOrgContactRecordKey),
        sp.resolve(IDeleteOrgContactRecordKey),
        sp.resolve(IHandlerContextKey),
        sp.resolve(ICreateContactsKey),
      ),
  );

  services.addTransient(
    IUpdateOrgContactKey,
    (sp) =>
      new UpdateOrgContactHandler(
        sp.resolve(IFindOrgContactByIdKey),
        sp.resolve(IUpdateOrgContactRecordKey),
        sp.resolve(IHandlerContextKey),
        sp.resolve(IUpdateContactsByExtKeysKey),
      ),
  );

  services.addTransient(
    IDeleteOrgContactKey,
    (sp) =>
      new DeleteOrgContact(
        sp.resolve(IFindOrgContactByIdKey),
        sp.resolve(IDeleteOrgContactRecordKey),
        sp.resolve(IHandlerContextKey),
        sp.resolve(IDeleteContactsByExtKeysKey),
      ),
  );

  services.addTransient(
    ICreateUserContactKey,
    (sp) => new CreateUserContact(sp.resolve(ICreateContactsKey), sp.resolve(IHandlerContextKey)),
  );

  // --- Query Handlers ---

  services.addTransient(
    IGetSignInEventsKey,
    (sp) =>
      new GetSignInEvents(
        sp.resolve(IFindSignInEventsByUserIdKey),
        sp.resolve(ICountSignInEventsByUserIdKey),
        sp.resolve(IGetLatestSignInEventDateKey),
        sp.resolve(IHandlerContextKey),
      ),
  );

  services.addTransient(
    IGetActiveConsentsKey,
    (sp) =>
      new GetActiveConsents(
        sp.resolve(IFindActiveConsentsByUserIdKey),
        sp.resolve(IHandlerContextKey),
      ),
  );

  services.addTransient(
    IGetOrgContactsKey,
    (sp) =>
      new GetOrgContacts(
        sp.resolve(IFindOrgContactsByOrgIdKey),
        sp.resolve(IHandlerContextKey),
        sp.resolve(IGetContactsByExtKeysKey),
      ),
  );

  services.addTransient(
    ICheckSignInThrottleKey,
    (sp) =>
      new CheckSignInThrottle(sp.resolve(ISignInThrottleStoreKey), sp.resolve(IHandlerContextKey)),
  );

}
