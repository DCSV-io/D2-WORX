import type { IHandler } from "@d2/handler";
import type { OrgContact } from "@d2/auth-domain";

export interface CreateOrgContactRecordInput {
  readonly contact: OrgContact;
}

export interface CreateOrgContactRecordOutput {}

export type ICreateOrgContactRecordHandler =
  IHandler<CreateOrgContactRecordInput, CreateOrgContactRecordOutput>;
