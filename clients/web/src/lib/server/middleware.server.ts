/**
 * Server-side middleware composition module.
 *
 * Lazy singleton initialization for Redis, Geo gRPC, cache handlers,
 * FindWhoIs, RateLimitCheck, and idempotency handlers. Pattern mirrors
 * auth/api/src/composition-root.ts but simplified — no DI container,
 * just module-level singletons with graceful degradation.
 *
 * The `.server.ts` suffix ensures this module is never included in
 * client-side bundles (SvelteKit convention).
 */
import Redis from "ioredis";
import { createLogger, type ILogger } from "@d2/logging";
import { HandlerContext } from "@d2/handler";
import { parseRedisUrl } from "@d2/service-defaults/config";
import * as CacheRedis from "@d2/cache-redis";
import { MemoryCacheStore } from "@d2/cache-memory";
import {
  createGeoServiceClient,
  FindWhoIs,
  DEFAULT_GEO_CLIENT_OPTIONS,
  type GeoClientOptions,
} from "@d2/geo-client";
import { Check as RateLimitCheck } from "@d2/ratelimit";
import { Check as IdempotencyCheck, checkIdempotency } from "@d2/idempotency";
import { enrichRequest } from "@d2/request-enrichment";
import type { RateLimit, Idempotency, DistributedCache } from "@d2/interfaces";

// Re-export for use in hook wrappers.
export { enrichRequest };
export { checkIdempotency };
export type { IdempotencyResult } from "@d2/idempotency";

export interface MiddlewareContext {
  logger: ILogger;
  findWhoIs: FindWhoIs;
  rateLimitCheck: RateLimit.ICheckHandler;
  idempotencyCheck: Idempotency.ICheckHandler;
  redisGet: DistributedCache.IGetHandler<string>;
  redisSet: DistributedCache.ISetHandler<string>;
  redisSetNx: DistributedCache.ISetNxHandler<string>;
  redisRemove: DistributedCache.IRemoveHandler;
}

let cached: MiddlewareContext | null = null;
let initAttempted = false;

/**
 * Returns the shared middleware context (lazy singleton).
 * Returns `null` if required env vars are missing — all middleware
 * hooks become no-ops, allowing SvelteKit to run without Redis/Geo
 * for local frontend development.
 */
export function getMiddlewareContext(): MiddlewareContext | null {
  if (cached) return cached;
  if (initAttempted) return null;
  initAttempted = true;

  const redisConnectionString = process.env.ConnectionStrings__d2_redis ?? process.env["ConnectionStrings__d2-redis"];
  const geoAddress = process.env.GEO_GRPC_ADDRESS;
  const geoApiKey = process.env.SVELTEKIT_GEO_CLIENT__APIKEY;

  if (!redisConnectionString || !geoAddress || !geoApiKey) {
    const missing: string[] = [];
    if (!redisConnectionString) missing.push("ConnectionStrings__d2-redis");
    if (!geoAddress) missing.push("GEO_GRPC_ADDRESS");
    if (!geoApiKey) missing.push("SVELTEKIT_GEO_CLIENT__APIKEY");
    console.warn(
      `[d2-sveltekit] Server middleware disabled — missing env vars: ${missing.join(", ")}. ` +
        "This is expected during local frontend-only development.",
    );
    return null;
  }

  try {
    const logger = createLogger({ serviceName: "d2-sveltekit" });

    // Redis (lazyConnect: no startup blocking, connects on first operation)
    const redisUrl = parseRedisUrl(redisConnectionString);
    const redis = new Redis(redisUrl, { lazyConnect: true });

    // Service-level HandlerContext (pre-auth: no per-request user info)
    const serviceContext = new HandlerContext(
      {
        isAuthenticated: false,
        isAgentStaff: false,
        isAgentAdmin: false,
        isTargetingStaff: false,
        isTargetingAdmin: false,
        isOrgEmulating: false,
        isUserImpersonating: false,
      },
      logger,
    );

    // Redis cache handlers (singletons — shared Redis connection)
    const redisGet = new CacheRedis.Get<string>(redis, serviceContext);
    const redisSet = new CacheRedis.Set<string>(redis, serviceContext);
    const redisSetNx = new CacheRedis.SetNx<string>(redis, serviceContext);
    const redisRemove = new CacheRedis.Remove(redis, serviceContext);
    const redisExists = new CacheRedis.Exists(redis, serviceContext);
    const redisGetTtl = new CacheRedis.GetTtl(redis, serviceContext);
    const redisIncrement = new CacheRedis.Increment(redis, serviceContext);

    // Geo gRPC client + FindWhoIs handler (memory-cached WhoIs lookups)
    const geoOptions: GeoClientOptions = {
      ...DEFAULT_GEO_CLIENT_OPTIONS,
      allowedContextKeys: [],
      apiKey: geoApiKey,
    };
    const geoClient = createGeoServiceClient(geoAddress, geoApiKey);
    const whoIsCacheStore = new MemoryCacheStore();
    const findWhoIs = new FindWhoIs(whoIsCacheStore, geoClient, geoOptions, serviceContext);

    // Rate limit check handler (Redis-backed sliding window)
    const rateLimitCheck = new RateLimitCheck(
      redisGetTtl,
      redisIncrement,
      redisSet,
      {},
      serviceContext,
    );

    // Idempotency check handler (Redis-backed SET NX)
    const idempotencyCheck = new IdempotencyCheck(redisSetNx, redisGet, {}, serviceContext);

    cached = {
      logger,
      findWhoIs,
      rateLimitCheck,
      idempotencyCheck,
      redisGet,
      redisSet,
      redisSetNx,
      redisRemove,
    };

    logger.info("Server middleware initialized (request enrichment, rate limiting, idempotency).");
    return cached;
  } catch (error) {
    console.error("[d2-sveltekit] Failed to initialize server middleware:", error);
    return null;
  }
}
