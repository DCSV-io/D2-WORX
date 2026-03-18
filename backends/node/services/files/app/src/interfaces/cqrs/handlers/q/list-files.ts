import type { IHandler } from "@d2/handler";
import type { File } from "@d2/files-domain";

export interface ListFilesInput {
  readonly contextKey: string;
  readonly relatedEntityId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListFilesOutput {
  readonly files: readonly File[];
  readonly total: number;
}

export interface IListFilesHandler extends IHandler<ListFilesInput, ListFilesOutput> {}
