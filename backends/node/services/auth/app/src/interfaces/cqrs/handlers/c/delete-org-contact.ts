import type { IHandler } from "@d2/handler";

export interface DeleteOrgContactInput {
  readonly id: string;
  readonly organizationId: string;
}

export type DeleteOrgContactOutput = Record<string, never>;

/** Handler for deleting org contacts. */
export interface IDeleteOrgContactHandler extends IHandler<
  DeleteOrgContactInput,
  DeleteOrgContactOutput
> {}
