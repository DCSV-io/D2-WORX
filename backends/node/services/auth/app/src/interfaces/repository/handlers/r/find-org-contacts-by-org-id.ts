import type { IHandler } from "@d2/handler";
import type { OrgContact } from "@d2/auth-domain";

export interface FindOrgContactsByOrgIdInput {
  readonly organizationId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface FindOrgContactsByOrgIdOutput {
  readonly contacts: OrgContact[];
}

export type IFindOrgContactsByOrgIdHandler =
  IHandler<FindOrgContactsByOrgIdInput, FindOrgContactsByOrgIdOutput>;
