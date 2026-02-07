import type { IHandler } from "@d2/handler";
import type { WhoIsDTO } from "@d2/protos";

export interface FindWhoIsInput {
  ipAddress: string;
  fingerprint: string;
}

export interface FindWhoIsOutput {
  whoIs: WhoIsDTO | undefined;
}

export type IFindWhoIsHandler = IHandler<FindWhoIsInput, FindWhoIsOutput>;
