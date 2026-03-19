import type { IHandler } from "@d2/handler";

export interface CallOnFileProcessedInput {
  readonly address: string;
  readonly fileId: string;
  readonly contextKey: string;
  readonly relatedEntityId: string;
  readonly status: "ready" | "rejected";
  readonly variants?: readonly string[];
}

export interface CallOnFileProcessedOutput {
  readonly success: boolean;
}

/** gRPC OnFileProcessed call — notifies the owning service that processing completed. */
export type ICallOnFileProcessed = IHandler<CallOnFileProcessedInput, CallOnFileProcessedOutput>;
