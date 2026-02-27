import type { IHandler } from "@d2/handler";
import type { Message } from "@d2/comms-domain";

export interface FindMessageByIdInput {
  readonly id: string;
}

export interface FindMessageByIdOutput {
  readonly message: Message;
}

export type IFindMessageByIdHandler = IHandler<FindMessageByIdInput, FindMessageByIdOutput>;
