import type { IHandler } from "@d2/handler";
import type { FileVariant } from "@d2/files-domain";

export interface NotifyFileProcessedInput {
  readonly url: string;
  readonly fileId: string;
  readonly contextKey: string;
  readonly relatedEntityId: string;
  readonly status: "ready" | "rejected";
  readonly variants?: readonly FileVariant[];
}

export interface NotifyFileProcessedOutput {
  readonly success: boolean;
}

/** gRPC OnFileProcessed callback — notifies the owning service that processing completed. */
export interface INotifyFileProcessedHandler extends IHandler<
  NotifyFileProcessedInput,
  NotifyFileProcessedOutput
> {}
