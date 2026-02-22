import type { IHandler, RedactionSpec } from "@d2/handler";
import type { ContactDTO } from "@d2/protos";

export interface GetContactsByIdsInput {
  ids: string[];
}

export interface GetContactsByIdsOutput {
  /** Key: contact ID → ContactDTO */
  data: Map<string, ContactDTO>;
}

/** Recommended redaction for GetContactsByIds handlers. */
export const GET_CONTACTS_BY_IDS_REDACTION: RedactionSpec = {
  suppressOutput: true, // Output contains contact PII
};

/** Handler for fetching Geo contacts by their IDs. Requires redaction (output contains PII). */
export interface IGetContactsByIdsHandler extends IHandler<
  GetContactsByIdsInput,
  GetContactsByIdsOutput
> {
  readonly redaction: RedactionSpec;
}
