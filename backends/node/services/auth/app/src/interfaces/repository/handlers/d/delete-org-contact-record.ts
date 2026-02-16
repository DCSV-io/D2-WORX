import type { IHandler } from "@d2/handler";

export interface DeleteOrgContactRecordInput {
  readonly id: string;
}

export interface DeleteOrgContactRecordOutput {}

export type IDeleteOrgContactRecordHandler = IHandler<
  DeleteOrgContactRecordInput,
  DeleteOrgContactRecordOutput
>;
