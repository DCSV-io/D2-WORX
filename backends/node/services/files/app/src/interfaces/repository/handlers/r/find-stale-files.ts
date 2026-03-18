import type { IHandler } from "@d2/handler";
import type { File, FileStatus } from "@d2/files-domain";

export interface FindStaleFilesInput {
  readonly status: FileStatus;
  readonly cutoffDate: Date;
  readonly limit: number;
}

export interface FindStaleFilesOutput {
  readonly files: readonly File[];
}

export type IFindStaleFilesHandler = IHandler<FindStaleFilesInput, FindStaleFilesOutput>;
