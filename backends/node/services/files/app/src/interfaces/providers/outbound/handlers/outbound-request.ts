import type { IHandler } from "@d2/handler";

export interface OutboundRequestInput {
  readonly url: string;
  readonly payload: Record<string, unknown>;
  readonly timeoutMs?: number;
}

export interface OutboundRequestOutput {
  readonly body: Record<string, unknown>;
}

/** Generic outbound request provider — POSTs a JSON payload to a URL. Infra implements transport. */
export type IOutboundRequest = IHandler<OutboundRequestInput, OutboundRequestOutput>;
