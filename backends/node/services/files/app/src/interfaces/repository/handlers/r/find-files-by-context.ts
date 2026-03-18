import type { IHandler } from "@d2/handler";
import type { File } from "@d2/files-domain";

export interface FindFilesByContextInput {
  readonly contextKey: string;
  readonly relatedEntityId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface FindFilesByContextOutput {
  readonly files: readonly File[];
  readonly total: number;
}

export type IFindFilesByContextHandler = IHandler<
  FindFilesByContextInput,
  FindFilesByContextOutput
>;
