import type { IHandler } from "@d2/handler";

export interface HeadStorageObjectInput {
  readonly key: string;
}

export interface HeadStorageObjectOutput {
  readonly exists: boolean;
  readonly contentType?: string;
  readonly sizeBytes?: number;
}

/** Checks if an object exists in storage and returns its metadata. */
export type IHeadStorageObject = IHandler<HeadStorageObjectInput, HeadStorageObjectOutput>;
