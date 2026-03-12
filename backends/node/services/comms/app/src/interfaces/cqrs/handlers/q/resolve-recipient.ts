import type { IHandler, RedactionSpec } from "@d2/handler";

export interface ResolveRecipientInput {
  readonly contactId: string;
}

export interface ResolveRecipientOutput {
  readonly email?: string;
  readonly phone?: string;
}

/** Recommended redaction for RecipientResolver handlers. */
export const RESOLVE_RECIPIENT_REDACTION: RedactionSpec = {
  outputFields: ["email", "phone"],
};

/** Handler for resolving recipient contact information. Requires redaction (output contains PII). */
export interface IRecipientResolverHandler extends IHandler<
  ResolveRecipientInput,
  ResolveRecipientOutput
> {
  readonly redaction: RedactionSpec;
}
