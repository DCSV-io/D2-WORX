import type { IHandler } from "@d2/handler";
import type { TemplateWrapper } from "@d2/comms-domain";

export interface CreateTemplateWrapperRecordInput {
  readonly template: TemplateWrapper;
}

export interface CreateTemplateWrapperRecordOutput {}

export type ICreateTemplateWrapperRecordHandler = IHandler<
  CreateTemplateWrapperRecordInput,
  CreateTemplateWrapperRecordOutput
>;
