import type { IHandler, RedactionSpec } from "@d2/handler";
import type { WhoIsDTO } from "@d2/protos";

export interface FindWhoIsInput {
  ipAddress: string;
}

export interface FindWhoIsOutput {
  whoIs: WhoIsDTO | undefined;
}

/** Recommended redaction for FindWhoIs handlers. */
export const FIND_WHOIS_REDACTION: RedactionSpec = {
  inputFields: ["ipAddress"],
  suppressOutput: true, // WhoIsDTO is proto-generated, contains IP + location
};

/** Handler for finding WhoIs data. Requires redaction (I/O contains PII). */
export interface IFindWhoIsHandler extends IHandler<FindWhoIsInput, FindWhoIsOutput> {
  readonly redaction: RedactionSpec;
}
