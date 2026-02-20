import type { IHandler } from "@d2/handler";
import type { Channel, TemplateWrapper } from "@d2/comms-domain";

export interface FindTemplateByNameAndChannelInput {
  readonly name: string;
  readonly channel: Channel;
}

export interface FindTemplateByNameAndChannelOutput {
  readonly template: TemplateWrapper | null;
}

export type IFindTemplateByNameAndChannelHandler = IHandler<
  FindTemplateByNameAndChannelInput,
  FindTemplateByNameAndChannelOutput
>;
