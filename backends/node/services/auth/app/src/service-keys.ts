import { createServiceKey } from "@d2/di";

// Import interface types for keys
import type {
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
} from "./interfaces/repository/handlers/index.js";
import type { ISignInThrottleStore } from "./interfaces/repository/sign-in-throttle-store.js";
import type { RecordSignInEvent } from "./implementations/cqrs/handlers/c/record-sign-in-event.js";
import type { RecordSignInOutcome } from "./implementations/cqrs/handlers/c/record-sign-in-outcome.js";
import type { CreateEmulationConsent } from "./implementations/cqrs/handlers/c/create-emulation-consent.js";
import type { RevokeEmulationConsent } from "./implementations/cqrs/handlers/c/revoke-emulation-consent.js";
import type { CreateOrgContact } from "./implementations/cqrs/handlers/c/create-org-contact.js";
import type { UpdateOrgContactHandler } from "./implementations/cqrs/handlers/c/update-org-contact.js";
import type { DeleteOrgContact } from "./implementations/cqrs/handlers/c/delete-org-contact.js";
import type { CreateUserContact } from "./implementations/cqrs/handlers/c/create-user-contact.js";
import type { GetSignInEvents } from "./implementations/cqrs/handlers/q/get-sign-in-events.js";
import type { GetActiveConsents } from "./implementations/cqrs/handlers/q/get-active-consents.js";
import type { GetOrgContacts } from "./implementations/cqrs/handlers/q/get-org-contacts.js";
import type { CheckSignInThrottle } from "./implementations/cqrs/handlers/q/check-sign-in-throttle.js";
// =============================================================================
// Infrastructure-layer keys (interfaces defined in auth-app, implemented in auth-infra)
// =============================================================================

// --- Sign-In Event Repository Handlers ---

export const ICreateSignInEventKey = createServiceKey<ICreateSignInEventHandler>(
  "Auth.Repo.CreateSignInEvent",
);
export const IFindSignInEventsByUserIdKey = createServiceKey<IFindSignInEventsByUserIdHandler>(
  "Auth.Repo.FindSignInEventsByUserId",
);
export const ICountSignInEventsByUserIdKey = createServiceKey<ICountSignInEventsByUserIdHandler>(
  "Auth.Repo.CountSignInEventsByUserId",
);
export const IGetLatestSignInEventDateKey = createServiceKey<IGetLatestSignInEventDateHandler>(
  "Auth.Repo.GetLatestSignInEventDate",
);

// --- Emulation Consent Repository Handlers ---

export const ICreateEmulationConsentRecordKey =
  createServiceKey<ICreateEmulationConsentRecordHandler>("Auth.Repo.CreateEmulationConsentRecord");
export const IFindEmulationConsentByIdKey = createServiceKey<IFindEmulationConsentByIdHandler>(
  "Auth.Repo.FindEmulationConsentById",
);
export const IFindActiveConsentsByUserIdKey = createServiceKey<IFindActiveConsentsByUserIdHandler>(
  "Auth.Repo.FindActiveConsentsByUserId",
);
export const IFindActiveConsentByUserIdAndOrgKey =
  createServiceKey<IFindActiveConsentByUserIdAndOrgHandler>(
    "Auth.Repo.FindActiveConsentByUserIdAndOrg",
  );
export const IRevokeEmulationConsentRecordKey =
  createServiceKey<IRevokeEmulationConsentRecordHandler>("Auth.Repo.RevokeEmulationConsentRecord");

// --- Org Contact Repository Handlers ---

export const ICreateOrgContactRecordKey = createServiceKey<ICreateOrgContactRecordHandler>(
  "Auth.Repo.CreateOrgContactRecord",
);
export const IFindOrgContactByIdKey = createServiceKey<IFindOrgContactByIdHandler>(
  "Auth.Repo.FindOrgContactById",
);
export const IFindOrgContactsByOrgIdKey = createServiceKey<IFindOrgContactsByOrgIdHandler>(
  "Auth.Repo.FindOrgContactsByOrgId",
);
export const IUpdateOrgContactRecordKey = createServiceKey<IUpdateOrgContactRecordHandler>(
  "Auth.Repo.UpdateOrgContactRecord",
);
export const IDeleteOrgContactRecordKey = createServiceKey<IDeleteOrgContactRecordHandler>(
  "Auth.Repo.DeleteOrgContactRecord",
);

// --- Sign-In Throttle Store ---

export const ISignInThrottleStoreKey = createServiceKey<ISignInThrottleStore>(
  "Auth.SignInThrottleStore",
);

// =============================================================================
// Application-layer keys (defined and implemented in auth-app)
// =============================================================================

// --- Command Handlers ---

export const IRecordSignInEventKey = createServiceKey<RecordSignInEvent>(
  "Auth.App.RecordSignInEvent",
);
export const IRecordSignInOutcomeKey = createServiceKey<RecordSignInOutcome>(
  "Auth.App.RecordSignInOutcome",
);
export const ICreateEmulationConsentKey = createServiceKey<CreateEmulationConsent>(
  "Auth.App.CreateEmulationConsent",
);
export const IRevokeEmulationConsentKey = createServiceKey<RevokeEmulationConsent>(
  "Auth.App.RevokeEmulationConsent",
);
export const ICreateOrgContactKey = createServiceKey<CreateOrgContact>("Auth.App.CreateOrgContact");
export const IUpdateOrgContactKey = createServiceKey<UpdateOrgContactHandler>(
  "Auth.App.UpdateOrgContact",
);
export const IDeleteOrgContactKey = createServiceKey<DeleteOrgContact>("Auth.App.DeleteOrgContact");
export const ICreateUserContactKey = createServiceKey<CreateUserContact>(
  "Auth.App.CreateUserContact",
);

// --- Query Handlers ---

export const IGetSignInEventsKey = createServiceKey<GetSignInEvents>("Auth.App.GetSignInEvents");
export const IGetActiveConsentsKey = createServiceKey<GetActiveConsents>(
  "Auth.App.GetActiveConsents",
);
export const IGetOrgContactsKey = createServiceKey<GetOrgContacts>("Auth.App.GetOrgContacts");
export const ICheckSignInThrottleKey = createServiceKey<CheckSignInThrottle>(
  "Auth.App.CheckSignInThrottle",
);

