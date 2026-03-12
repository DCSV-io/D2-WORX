import type { IHandler, RedactionSpec } from "@d2/handler";
import type { OrgContact, UpdateOrgContactInput } from "@d2/auth-domain";
import type { ContactDTO } from "@d2/protos";
import type { ContactInput } from "./create-org-contact.js";

export interface UpdateOrgContactHandlerInput {
  readonly id: string;
  readonly organizationId: string;
  readonly updates: UpdateOrgContactInput & {
    /** If provided, triggers contact replacement via UpdateContactsByExtKeys. */
    readonly contact?: ContactInput;
  };
}

export type UpdateOrgContactOutput = {
  contact: OrgContact;
  geoContact?: ContactDTO;
};

/** Recommended redaction for UpdateOrgContact handlers. */
export const UPDATE_ORG_CONTACT_REDACTION: RedactionSpec = {
  suppressInput: true,
  suppressOutput: true,
};

/** Handler for updating org contacts. Requires redaction (I/O contains PII). */
export interface IUpdateOrgContactHandler extends IHandler<
  UpdateOrgContactHandlerInput,
  UpdateOrgContactOutput
> {
  readonly redaction: RedactionSpec;
}
