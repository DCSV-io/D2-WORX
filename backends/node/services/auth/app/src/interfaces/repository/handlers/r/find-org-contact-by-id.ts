import type { IHandler } from "@d2/handler";
import type { OrgContact } from "@d2/auth-domain";

export interface FindOrgContactByIdInput {
  readonly id: string;
}

export interface FindOrgContactByIdOutput {
  readonly contact: OrgContact;
}

export type IFindOrgContactByIdHandler = IHandler<
  FindOrgContactByIdInput,
  FindOrgContactByIdOutput
>;
