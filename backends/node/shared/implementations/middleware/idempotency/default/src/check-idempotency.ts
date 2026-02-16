import type { ILogger } from "@d2/logging";
import type { DistributedCache, Idempotency } from "@d2/interfaces";
import { DEFAULT_IDEMPOTENCY_OPTIONS, type IdempotencyOptions } from "./idempotency-options.js";

const KEY_PREFIX = "idempotency:";

/** Result from checking idempotency state. */
export interface IdempotencyResult {
  state: Idempotency.IdempotencyState;
  cachedResponse: Idempotency.CachedResponse | undefined;
  /** Call after downstream completes to store the response for future replays. */
  storeResponse: (response: Idempotency.CachedResponse) => Promise<void>;
  /** Call if the response is not cacheable to remove the sentinel lock. */
  removeLock: () => Promise<void>;
}

/**
 * Framework-agnostic idempotency check orchestrator.
 * Mirrors the flow in IdempotencyMiddleware.cs but returns an IdempotencyResult
 * so consumers (Hono, Express, etc.) can wire it into their framework.
 *
 * @param idempotencyKey - The client-provided idempotency key.
 * @param checkHandler - The idempotency Check handler.
 * @param setHandler - Distributed cache SET handler (for storing cached responses).
 * @param removeHandler - Distributed cache REMOVE handler (for sentinel cleanup).
 * @param options - Optional partial options (merged with defaults).
 * @param logger - Optional logger.
 */
export async function checkIdempotency(
  idempotencyKey: string,
  checkHandler: Idempotency.ICheckHandler,
  setHandler: DistributedCache.ISetHandler<string>,
  removeHandler: DistributedCache.IRemoveHandler,
  options?: Partial<IdempotencyOptions>,
  logger?: ILogger,
): Promise<IdempotencyResult> {
  const opts = { ...DEFAULT_IDEMPOTENCY_OPTIONS, ...options };
  const cacheKey = `${KEY_PREFIX}${idempotencyKey}`;

  const checkResult = await checkHandler.handleAsync({ idempotencyKey });

  const state = checkResult.success ? (checkResult.data?.state ?? "acquired") : "acquired";
  const cachedResponse = checkResult.success ? checkResult.data?.cachedResponse : undefined;

  return {
    state,
    cachedResponse,

    async storeResponse(response: Idempotency.CachedResponse): Promise<void> {
      try {
        const serialized = JSON.stringify(response);
        await setHandler.handleAsync({
          key: cacheKey,
          value: serialized,
          expirationMs: opts.cacheTtlMs,
        });
      } catch {
        // Response already sent — just log.
        logger?.warn(`Failed to cache idempotent response for key ${idempotencyKey}.`);
      }
    },

    async removeLock(): Promise<void> {
      try {
        await removeHandler.handleAsync({ key: cacheKey });
      } catch {
        logger?.warn(`Failed to remove idempotency sentinel for key ${idempotencyKey}.`);
      }
    },
  };
}
