import type { IHandler } from "@d2/handler";
import type { OrgContact } from "@d2/auth-domain";

export interface UpdateOrgContactRecordInput {
  readonly contact: OrgContact;
}

export interface UpdateOrgContactRecordOutput {}

export type IUpdateOrgContactRecordHandler = IHandler<
  UpdateOrgContactRecordInput,
  UpdateOrgContactRecordOutput
>;
