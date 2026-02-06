import type { IHandler } from "@d2/handler";

// ---------------------------------------------------------------------------
// Read (R)
// ---------------------------------------------------------------------------

/** Input for getting a single value from the in-memory cache. */
export interface GetInput {
  key: string;
}

/** Output for getting a single value from the in-memory cache. */
export interface GetOutput<TValue> {
  value: TValue;
}

/** Handler for getting a single value from the in-memory cache. */
export type IGetHandler<TValue> = IHandler<GetInput, GetOutput<TValue>>;

/** Input for getting multiple values from the in-memory cache. */
export interface GetManyInput {
  keys: string[];
}

/** Output for getting multiple values from the in-memory cache. */
export interface GetManyOutput<TValue> {
  values: Record<string, TValue>;
}

/** Handler for getting multiple values from the in-memory cache. */
export type IGetManyHandler<TValue> = IHandler<GetManyInput, GetManyOutput<TValue>>;

// ---------------------------------------------------------------------------
// Update (U)
// ---------------------------------------------------------------------------

/** Input for setting a single value in the in-memory cache. */
export interface SetInput<TValue> {
  key: string;
  value: TValue;
  expirationMs?: number;
}

/** Output for setting a single value in the in-memory cache. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetOutput {}

/** Handler for setting a single value in the in-memory cache. */
export type ISetHandler<TValue> = IHandler<SetInput<TValue>, SetOutput>;

/** Input for setting multiple values in the in-memory cache. */
export interface SetManyInput<TValue> {
  values: Record<string, TValue>;
  expirationMs?: number;
}

/** Output for setting multiple values in the in-memory cache. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetManyOutput {}

/** Handler for setting multiple values in the in-memory cache. */
export type ISetManyHandler<TValue> = IHandler<SetManyInput<TValue>, SetManyOutput>;

// ---------------------------------------------------------------------------
// Delete (D)
// ---------------------------------------------------------------------------

/** Input for removing a single key from the in-memory cache. */
export interface RemoveInput {
  key: string;
}

/** Output for removing a single key from the in-memory cache. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RemoveOutput {}

/** Handler for removing a single key from the in-memory cache. */
export type IRemoveHandler = IHandler<RemoveInput, RemoveOutput>;
