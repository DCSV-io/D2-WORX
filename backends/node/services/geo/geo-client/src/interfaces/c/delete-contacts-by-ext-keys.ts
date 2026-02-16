import type { IHandler } from "@d2/handler";

export interface DeleteContactsByExtKeysInput {
  keys: Array<{ contextKey: string; relatedEntityId: string }>;
}

export interface DeleteContactsByExtKeysOutput {
  deleted: number;
}

/** Handler for deleting Geo contacts by ext keys via gRPC. */
export type IDeleteContactsByExtKeysHandler = IHandler<
  DeleteContactsByExtKeysInput,
  DeleteContactsByExtKeysOutput
>;
