/**
 * Singleflight deduplicates concurrent in-flight operations by key.
 *
 * The first caller for a given key executes the operation; subsequent callers
 * for the same key share the same Promise. Once the operation completes
 * (success or failure), the key is removed — it is NOT a cache.
 *
 * Mirrors D2.Shared.Utilities.Singleflight.Singleflight in .NET.
 */
export class Singleflight {
  private readonly _inflight = new Map<string, Promise<unknown>>();

  /** Returns the number of currently in-flight operations. */
  get size(): number {
    return this._inflight.size;
  }

  /**
   * Executes the operation for the given key. If an operation is already
   * in-flight for that key, returns the existing Promise instead of
   * starting a new one.
   */
  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this._inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = operation().finally(() => {
      this._inflight.delete(key);
    });
    this._inflight.set(key, promise);
    return promise;
  }
}
