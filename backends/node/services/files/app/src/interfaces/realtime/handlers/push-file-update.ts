import type { IHandler } from "@d2/handler";

export interface PushFileUpdateInput {
  /** The user ID to push the update to (connected via SignalR). */
  readonly userId: string;
  /** The file that was processed. */
  readonly fileId: string;
  /** The context key of the file (e.g., "user_avatar", "thread_attachment"). */
  readonly contextKey: string;
  /** Final status after processing. */
  readonly status: "ready" | "rejected";
  /** Rejection reason if status is "rejected". */
  readonly rejectionReason?: string;
  /** Variant names available (e.g., ["original", "thumb", "medium"]). */
  readonly variants?: readonly string[];
}

export interface PushFileUpdateOutput {
  /** Whether the push was delivered (false if user is not connected). */
  readonly delivered: boolean;
}

/** Pushes a file processing update to a connected client via the SignalR gateway. */
export type IPushFileUpdate = IHandler<PushFileUpdateInput, PushFileUpdateOutput>;
