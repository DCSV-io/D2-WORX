import type { IHandler } from "@d2/handler";

export interface SendEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly plainText: string;
  readonly replyTo?: string;
}

export interface SendEmailOutput {
  readonly providerMessageId: string;
}

export type IEmailProvider = IHandler<SendEmailInput, SendEmailOutput>;
