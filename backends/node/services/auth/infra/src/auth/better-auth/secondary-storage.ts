import type { SecondaryStorage } from "better-auth";
import type { DistributedCache } from "@d2/interfaces";

/**
 * Wraps @d2/interfaces distributed cache handlers behind BetterAuth's
 * SecondaryStorage contract ({ get, set, delete }).
 *
 * auth-infra never imports ioredis directly — it only depends on the
 * handler abstractions from @d2/interfaces, which are implemented by
 * @d2/cache-redis at the composition root.
 */
export function createSecondaryStorage(deps: {
  get: DistributedCache.IGetHandler<string>;
  set: DistributedCache.ISetHandler<string>;
  remove: DistributedCache.IRemoveHandler;
}): SecondaryStorage {
  return {
    async get(key: string): Promise<string | null> {
      const result = await deps.get.handleAsync({ key });
      if (result.success && result.data?.value !== undefined) {
        return result.data.value;
      }
      return null;
    },

    async set(key: string, value: string, ttl?: number): Promise<void> {
      // BetterAuth passes TTL in seconds; our handler expects milliseconds.
      const expirationMs = ttl !== undefined ? ttl * 1000 : undefined;
      await deps.set.handleAsync({ key, value, expirationMs });
    },

    async delete(key: string): Promise<void> {
      await deps.remove.handleAsync({ key });
    },
  };
}
