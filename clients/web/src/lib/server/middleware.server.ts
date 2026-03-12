/**
 * Server-side middleware composition module.
 *
 * Lazy singleton initialization for Redis, Geo gRPC, cache handlers,
 * FindWhoIs, CheckRateLimit, and idempotency handlers. Pattern mirrors
 * auth/api/src/composition-root.ts but simplified — no DI container,
 * just module-level singletons.
 *
 * Throws if required env vars are missing — infrastructure (Redis, Geo service)
 * must be running. Matches auth.server.ts and gateway.server.ts behavior.
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
import { Singleflight } from "@d2/utilities";
import {
  createGeoServiceClient,
  createGeoCircuitBreaker,
  FindWhoIs,
  Get as GetGeoRefData,
  GetFromMem,
  GetFromDist,
  GetFromDisk,
  ReqUpdate,
  SetInMem,
  SetOnDisk,
  GeoRefDataSerializer,
  DEFAULT_GEO_CLIENT_OPTIONS,
  type GeoClientOptions,
} from "@d2/geo-client";
import type { GeoRefData } from "@d2/protos";
import { CheckRateLimit } from "@d2/ratelimit";
import { CheckIdempotency, checkIdempotency } from "@d2/idempotency";
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
  getGeoRefData: GetGeoRefData;
}

let cached: MiddlewareContext | null | undefined;

/**
 * Whether infrastructure middleware can be skipped.
 *
 * Auto-detected via `CI` env var (GitHub Actions, GitLab CI, etc.) or
 * explicitly via `D2_SKIP_INFRA_MIDDLEWARE=true`. When enabled AND required
 * env vars are missing, returns null instead of throwing FATAL — allows
 * the SvelteKit dev server to serve pages that don't need middleware
 * (e.g. Playwright E2E tests against UI-only routes).
 *
 * In production (neither flag set), missing env vars always FATAL.
 */
const INFRA_SKIPPABLE =
  process.env.CI === "true" || process.env.D2_SKIP_INFRA_MIDDLEWARE === "true";

/**
 * Returns the shared middleware context (lazy singleton).
 *
 * - Production: throws FATAL if required env vars are missing.
 * - CI / skip mode: returns null when env vars are missing (hooks skip gracefully).
 */
export function getMiddlewareContext(): MiddlewareContext | null {
  if (cached !== undefined) return cached;

  const redisConnectionString = process.env.REDIS_URL;
  const geoAddress = process.env.GEO_GRPC_ADDRESS;
  const geoApiKey = process.env.SVELTEKIT_GEO_CLIENT__APIKEY;

  if (!redisConnectionString || !geoAddress || !geoApiKey) {
    const missing: string[] = [];
    if (!redisConnectionString) missing.push("REDIS_URL");
    if (!geoAddress) missing.push("GEO_GRPC_ADDRESS");
    if (!geoApiKey) missing.push("SVELTEKIT_GEO_CLIENT__APIKEY");

    if (INFRA_SKIPPABLE) {
      console.warn(
        `[d2-sveltekit] Infrastructure middleware skipped (missing: ${missing.join(", ")}). ` +
          "Requests will not be enriched, rate-limited, or idempotency-checked.",
      );
      cached = null;
      return null;
    }

    throw new Error(
      `[d2-sveltekit] FATAL: Missing required env vars: ${missing.join(", ")}. ` +
        "Infrastructure services must be running. Check your .env.local file.",
    );
  }

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
  const _redisExists = new CacheRedis.Exists(redis, serviceContext);
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
  const geoCircuitBreaker = createGeoCircuitBreaker(geoOptions, logger);
  const geoSingleflight = new Singleflight();
  const findWhoIs = new FindWhoIs(
    whoIsCacheStore,
    geoClient,
    geoOptions,
    geoCircuitBreaker,
    geoSingleflight,
    serviceContext,
  );

  // Geo reference data handler chain (Memory → Redis → Disk → gRPC)
  const refDataMemCache = new MemoryCacheStore();
  const getFromMem = new GetFromMem(refDataMemCache, serviceContext);
  const getFromDist = new GetFromDist(
    new CacheRedis.Get<GeoRefData>(redis, serviceContext, new GeoRefDataSerializer()),
    serviceContext,
  );
  const getFromDisk = new GetFromDisk(geoOptions, serviceContext);
  const setInMem = new SetInMem(refDataMemCache, serviceContext);
  const setOnDisk = new SetOnDisk(geoOptions, serviceContext);
  const reqUpdate = new ReqUpdate(geoClient, geoOptions, serviceContext);

  const getGeoRefData = new GetGeoRefData(
    { getFromMem, getFromDist, getFromDisk, reqUpdate, setInMem, setOnDisk },
    serviceContext,
  );

  // Rate limit check handler (Redis-backed sliding window)
  const rateLimitCheck = new CheckRateLimit(
    redisGetTtl,
    redisIncrement,
    redisSet,
    {},
    serviceContext,
  );

  // Idempotency check handler (Redis-backed SET NX)
  const idempotencyCheck = new CheckIdempotency(redisSetNx, redisGet, {}, serviceContext);

  cached = {
    logger,
    findWhoIs,
    rateLimitCheck,
    idempotencyCheck,
    redisGet,
    redisSet,
    redisSetNx,
    redisRemove,
    getGeoRefData,
  };

  logger.info("Server middleware initialized (request enrichment, rate limiting, idempotency).");
  return cached;
}
