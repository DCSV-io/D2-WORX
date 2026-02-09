import type { IHandler } from "@d2/handler";

/** Input for setting a value in the distributed cache only if the key does not already exist (SET NX). */
export interface SetNxInput<TValue> {
  key: string;
  value: TValue;
  expirationMs?: number;
}

/** Output for setting a value in the distributed cache only if the key does not already exist. */
export interface SetNxOutput {
  wasSet: boolean;
}

/** Handler for setting a value in the distributed cache only if the key does not already exist (SET NX). */
export type ISetNxHandler<TValue> = IHandler<SetNxInput<TValue>, SetNxOutput>;
