import type { IHandler } from "@d2/handler";

export interface SendSmsInput {
  readonly to: string;
  readonly body: string;
}

export interface SendSmsOutput {
  readonly providerMessageId: string;
}

export type ISmsProvider = IHandler<SendSmsInput, SendSmsOutput>;
