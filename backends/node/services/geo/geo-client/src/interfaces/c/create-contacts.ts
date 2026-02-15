import type { IHandler, RedactionSpec } from "@d2/handler";
import type { ContactToCreateDTO, ContactDTO } from "@d2/protos";

export interface CreateContactsInput {
  contacts: ContactToCreateDTO[];
}

export interface CreateContactsOutput {
  data: ContactDTO[];
}

/** Recommended redaction for CreateContacts handlers. */
export const CREATE_CONTACTS_REDACTION: RedactionSpec = {
  suppressInput: true, // Input contains contact PII
  suppressOutput: true, // Output contains contact PII
};

/** Handler for creating Geo contacts via gRPC. Requires redaction (I/O contains PII). */
export interface ICreateContactsHandler extends IHandler<CreateContactsInput, CreateContactsOutput> {
  readonly redaction: RedactionSpec;
}
