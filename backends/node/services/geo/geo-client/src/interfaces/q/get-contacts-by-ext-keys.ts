import type { IHandler, RedactionSpec } from "@d2/handler";
import type { ContactDTO } from "@d2/protos";

export interface GetContactsByExtKeysInput {
  keys: Array<{ contextKey: string; relatedEntityId: string }>;
}

export interface GetContactsByExtKeysOutput {
  /** Key: "contextKey:relatedEntityId" → ContactDTO[] */
  data: Map<string, ContactDTO[]>;
}

/** Recommended redaction for GetContactsByExtKeys handlers. */
export const GET_CONTACTS_BY_EXT_KEYS_REDACTION: RedactionSpec = {
  suppressOutput: true, // Output contains contact PII
};

/** Handler for fetching Geo contacts by ext keys. Requires redaction (output contains PII). */
export interface IGetContactsByExtKeysHandler
  extends IHandler<GetContactsByExtKeysInput, GetContactsByExtKeysOutput> {
  readonly redaction: RedactionSpec;
}
