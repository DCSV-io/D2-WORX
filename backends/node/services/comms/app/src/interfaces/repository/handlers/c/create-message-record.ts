import type { IHandler } from "@d2/handler";
import type { Message } from "@d2/comms-domain";

export interface CreateMessageRecordInput {
  readonly message: Message;
}

export interface CreateMessageRecordOutput {}

export type ICreateMessageRecordHandler = IHandler<CreateMessageRecordInput, CreateMessageRecordOutput>;
