// --- Handler type imports (used by bundle interfaces below) ---
import type { ICreateSignInEventHandler } from "./c/create-sign-in-event.js";
import type { ICreateEmulationConsentRecordHandler } from "./c/create-emulation-consent-record.js";
import type { ICreateOrgContactRecordHandler } from "./c/create-org-contact-record.js";
import type { IFindSignInEventsByUserIdHandler } from "./r/find-sign-in-events-by-user-id.js";
import type { ICountSignInEventsByUserIdHandler } from "./r/count-sign-in-events-by-user-id.js";
import type { IGetLatestSignInEventDateHandler } from "./r/get-latest-sign-in-event-date.js";
import type { IFindEmulationConsentByIdHandler } from "./r/find-emulation-consent-by-id.js";
import type { IFindActiveConsentsByUserIdHandler } from "./r/find-active-consents-by-user-id.js";
import type { IFindActiveConsentByUserIdAndOrgHandler } from "./r/find-active-consent-by-user-id-and-org.js";
import type { IFindOrgContactByIdHandler } from "./r/find-org-contact-by-id.js";
import type { IFindOrgContactsByOrgIdHandler } from "./r/find-org-contacts-by-org-id.js";
import type { IRevokeEmulationConsentRecordHandler } from "./u/revoke-emulation-consent-record.js";
import type { IUpdateOrgContactRecordHandler } from "./u/update-org-contact-record.js";
import type { IUpdateSignInEventWhoIsIdHandler } from "./u/update-sign-in-event-who-is-id.js";
import type { IDeleteOrgContactRecordHandler } from "./d/delete-org-contact-record.js";

// --- Create (C) ---
export type {
  CreateSignInEventInput,
  CreateSignInEventOutput,
  ICreateSignInEventHandler,
} from "./c/create-sign-in-event.js";

export type {
  CreateEmulationConsentRecordInput,
  CreateEmulationConsentRecordOutput,
  ICreateEmulationConsentRecordHandler,
} from "./c/create-emulation-consent-record.js";

export type {
  CreateOrgContactRecordInput,
  CreateOrgContactRecordOutput,
  ICreateOrgContactRecordHandler,
} from "./c/create-org-contact-record.js";

// --- Read (R) ---
export type {
  FindSignInEventsByUserIdInput,
  FindSignInEventsByUserIdOutput,
  IFindSignInEventsByUserIdHandler,
} from "./r/find-sign-in-events-by-user-id.js";

export type {
  CountSignInEventsByUserIdInput,
  CountSignInEventsByUserIdOutput,
  ICountSignInEventsByUserIdHandler,
} from "./r/count-sign-in-events-by-user-id.js";

export type {
  GetLatestSignInEventDateInput,
  GetLatestSignInEventDateOutput,
  IGetLatestSignInEventDateHandler,
} from "./r/get-latest-sign-in-event-date.js";

export type {
  FindEmulationConsentByIdInput,
  FindEmulationConsentByIdOutput,
  IFindEmulationConsentByIdHandler,
} from "./r/find-emulation-consent-by-id.js";

export type {
  FindActiveConsentsByUserIdInput,
  FindActiveConsentsByUserIdOutput,
  IFindActiveConsentsByUserIdHandler,
} from "./r/find-active-consents-by-user-id.js";

export type {
  FindActiveConsentByUserIdAndOrgInput,
  FindActiveConsentByUserIdAndOrgOutput,
  IFindActiveConsentByUserIdAndOrgHandler,
} from "./r/find-active-consent-by-user-id-and-org.js";

export type {
  FindOrgContactByIdInput,
  FindOrgContactByIdOutput,
  IFindOrgContactByIdHandler,
} from "./r/find-org-contact-by-id.js";

export type {
  FindOrgContactsByOrgIdInput,
  FindOrgContactsByOrgIdOutput,
  IFindOrgContactsByOrgIdHandler,
} from "./r/find-org-contacts-by-org-id.js";

// --- Update (U) ---
export type {
  RevokeEmulationConsentRecordInput,
  RevokeEmulationConsentRecordOutput,
  IRevokeEmulationConsentRecordHandler,
} from "./u/revoke-emulation-consent-record.js";

export type {
  UpdateOrgContactRecordInput,
  UpdateOrgContactRecordOutput,
  IUpdateOrgContactRecordHandler,
} from "./u/update-org-contact-record.js";

export type {
  UpdateSignInEventWhoIsIdInput,
  UpdateSignInEventWhoIsIdOutput,
  IUpdateSignInEventWhoIsIdHandler,
} from "./u/update-sign-in-event-who-is-id.js";

// --- Delete (D) ---
export type {
  DeleteOrgContactRecordInput,
  DeleteOrgContactRecordOutput,
  IDeleteOrgContactRecordHandler,
} from "./d/delete-org-contact-record.js";

// --- Query (Q) ---
export type { PingDbInput, PingDbOutput, IPingDbHandler } from "./q/ping-db.js";

// ---------------------------------------------------------------------------
// Bundle types — one per aggregate, used by app-layer factory functions
// ---------------------------------------------------------------------------

export interface SignInEventRepoHandlers {
  create: ICreateSignInEventHandler;
  findByUserId: IFindSignInEventsByUserIdHandler;
  countByUserId: ICountSignInEventsByUserIdHandler;
  getLatestEventDate: IGetLatestSignInEventDateHandler;
  updateWhoIsId: IUpdateSignInEventWhoIsIdHandler;
}

export interface EmulationConsentRepoHandlers {
  create: ICreateEmulationConsentRecordHandler;
  findById: IFindEmulationConsentByIdHandler;
  findActiveByUserId: IFindActiveConsentsByUserIdHandler;
  findActiveByUserIdAndOrg: IFindActiveConsentByUserIdAndOrgHandler;
  revoke: IRevokeEmulationConsentRecordHandler;
}

export interface OrgContactRepoHandlers {
  create: ICreateOrgContactRecordHandler;
  findById: IFindOrgContactByIdHandler;
  findByOrgId: IFindOrgContactsByOrgIdHandler;
  update: IUpdateOrgContactRecordHandler;
  delete: IDeleteOrgContactRecordHandler;
}
