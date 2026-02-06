import type { IHandler } from "@d2/handler";

// ---------------------------------------------------------------------------
// Read (R)
// ---------------------------------------------------------------------------

/** Input for getting a single value from the distributed cache. */
export interface GetInput {
  key: string;
}

/** Output for getting a single value from the distributed cache. Value is undefined if the key does not exist. */
export interface GetOutput<TValue> {
  value: TValue | undefined;
}

/** Handler for getting a single value from the distributed cache. */
export type IGetHandler<TValue> = IHandler<GetInput, GetOutput<TValue>>;

/** Input for checking if a key exists in the distributed cache. */
export interface ExistsInput {
  key: string;
}

/** Output for checking if a key exists in the distributed cache. */
export interface ExistsOutput {
  exists: boolean;
}

/** Handler for checking if a key exists in the distributed cache. */
export type IExistsHandler = IHandler<ExistsInput, ExistsOutput>;

/** Input for getting the remaining TTL of a cached key. */
export interface GetTtlInput {
  key: string;
}

/** Output for getting the remaining TTL of a cached key. Undefined if the key does not exist or has no expiration. */
export interface GetTtlOutput {
  timeToLiveMs: number | undefined;
}

/** Handler for getting the remaining TTL of a cached key. */
export type IGetTtlHandler = IHandler<GetTtlInput, GetTtlOutput>;

// ---------------------------------------------------------------------------
// Update (U)
// ---------------------------------------------------------------------------

/** Input for setting a single value in the distributed cache. */
export interface SetInput<TValue> {
  key: string;
  value: TValue;
  expirationMs?: number;
}

/** Output for setting a single value in the distributed cache. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetOutput {}

/** Handler for setting a single value in the distributed cache. */
export type ISetHandler<TValue> = IHandler<SetInput<TValue>, SetOutput>;

/** Input for atomically incrementing a counter in the distributed cache. */
export interface IncrementInput {
  key: string;
  amount?: number;
  expirationMs?: number;
}

/** Output for atomically incrementing a counter in the distributed cache. */
export interface IncrementOutput {
  newValue: number;
}

/** Handler for atomically incrementing a counter in the distributed cache. */
export type IIncrementHandler = IHandler<IncrementInput, IncrementOutput>;

// ---------------------------------------------------------------------------
// Delete (D)
// ---------------------------------------------------------------------------

/** Input for removing a single key from the distributed cache. */
export interface RemoveInput {
  key: string;
}

/** Output for removing a single key from the distributed cache. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RemoveOutput {}

/** Handler for removing a single key from the distributed cache. */
export type IRemoveHandler = IHandler<RemoveInput, RemoveOutput>;
