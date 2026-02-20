import type { IHandler } from "@d2/handler";
import type { TemplateWrapper } from "@d2/comms-domain";

export interface UpdateTemplateWrapperRecordInput {
  readonly template: TemplateWrapper;
}

export interface UpdateTemplateWrapperRecordOutput {}

export type IUpdateTemplateWrapperRecordHandler = IHandler<
  UpdateTemplateWrapperRecordInput,
  UpdateTemplateWrapperRecordOutput
>;
