import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { IHandlerContext } from "@d2/handler";
import type {
  SignInEventRepoHandlers,
  EmulationConsentRepoHandlers,
  OrgContactRepoHandlers,
} from "@d2/auth-app";
import { CreateSignInEvent } from "./c/create-sign-in-event.js";
import { FindSignInEventsByUserId } from "./r/find-sign-in-events-by-user-id.js";
import { CountSignInEventsByUserId } from "./r/count-sign-in-events-by-user-id.js";
import { GetLatestSignInEventDate } from "./r/get-latest-sign-in-event-date.js";
import { CreateEmulationConsentRecord } from "./c/create-emulation-consent-record.js";
import { FindEmulationConsentById } from "./r/find-emulation-consent-by-id.js";
import { FindActiveConsentsByUserId } from "./r/find-active-consents-by-user-id.js";
import { FindActiveConsentByUserIdAndOrg } from "./r/find-active-consent-by-user-id-and-org.js";
import { RevokeEmulationConsentRecord } from "./u/revoke-emulation-consent-record.js";
import { UpdateSignInEventWhoIsId } from "./u/update-sign-in-event-who-is-id.js";
import { CreateOrgContactRecord } from "./c/create-org-contact-record.js";
import { FindOrgContactById } from "./r/find-org-contact-by-id.js";
import { FindOrgContactsByOrgId } from "./r/find-org-contacts-by-org-id.js";
import { UpdateOrgContactRecord } from "./u/update-org-contact-record.js";
import { DeleteOrgContactRecord } from "./d/delete-org-contact-record.js";

export function createSignInEventRepoHandlers(
  db: NodePgDatabase,
  ctx: IHandlerContext,
): SignInEventRepoHandlers {
  return {
    create: new CreateSignInEvent(db, ctx),
    findByUserId: new FindSignInEventsByUserId(db, ctx),
    countByUserId: new CountSignInEventsByUserId(db, ctx),
    getLatestEventDate: new GetLatestSignInEventDate(db, ctx),
    updateWhoIsId: new UpdateSignInEventWhoIsId(db, ctx),
  };
}

export function createEmulationConsentRepoHandlers(
  db: NodePgDatabase,
  ctx: IHandlerContext,
): EmulationConsentRepoHandlers {
  return {
    create: new CreateEmulationConsentRecord(db, ctx),
    findById: new FindEmulationConsentById(db, ctx),
    findActiveByUserId: new FindActiveConsentsByUserId(db, ctx),
    findActiveByUserIdAndOrg: new FindActiveConsentByUserIdAndOrg(db, ctx),
    revoke: new RevokeEmulationConsentRecord(db, ctx),
  };
}

export function createOrgContactRepoHandlers(
  db: NodePgDatabase,
  ctx: IHandlerContext,
): OrgContactRepoHandlers {
  return {
    create: new CreateOrgContactRecord(db, ctx),
    findById: new FindOrgContactById(db, ctx),
    findByOrgId: new FindOrgContactsByOrgId(db, ctx),
    update: new UpdateOrgContactRecord(db, ctx),
    delete: new DeleteOrgContactRecord(db, ctx),
  };
}
