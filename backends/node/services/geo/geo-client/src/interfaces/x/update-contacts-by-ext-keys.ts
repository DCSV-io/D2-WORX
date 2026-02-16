import type { IHandler, RedactionSpec } from "@d2/handler";
import type { ContactToCreateDTO, ContactDTO } from "@d2/protos";

export interface UpdateContactsByExtKeysInput {
  contacts: ContactToCreateDTO[];
}

export interface UpdateContactsByExtKeysOutput {
  data: ContactDTO[];
}

/** Recommended redaction for UpdateContactsByExtKeys handlers. */
export const UPDATE_CONTACTS_BY_EXT_KEYS_REDACTION: RedactionSpec = {
  suppressInput: true, // Input contains contact PII
  suppressOutput: true, // Output contains contact PII
};

/** Handler for replacing Geo contacts at given ext keys. Requires redaction (I/O contains PII). */
export interface IUpdateContactsByExtKeysHandler extends IHandler<
  UpdateContactsByExtKeysInput,
  UpdateContactsByExtKeysOutput
> {
  readonly redaction: RedactionSpec;
}
