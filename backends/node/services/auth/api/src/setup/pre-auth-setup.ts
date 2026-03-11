import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { HandlerContext } from "@d2/handler";
import type { ILogger } from "@d2/logging";
import * as CacheMemory from "@d2/cache-memory";
import { FindWhoIs, createGeoCircuitBreaker, type GeoClientOptions } from "@d2/geo-client";
import { CheckRateLimit } from "@d2/ratelimit";
import { PASSWORD_POLICY } from "@d2/auth-domain";
import {
  CheckEmailAvailabilityRepo,
  createPasswordFunctions,
  type PasswordFunctions,
} from "@d2/auth-infra";
import {
  CheckSignInThrottle,
  RecordSignInOutcome,
  CheckEmailAvailability,
  type ISignInThrottleStore,
} from "@d2/auth-app";
import type { RedisSetup } from "./redis-setup.js";

export interface PreAuthSetup {
  rateLimitCheck: CheckRateLimit;
  findWhoIs: FindWhoIs;
  throttleCheck: CheckSignInThrottle;
  throttleRecord: RecordSignInOutcome;
  checkEmailHandler: CheckEmailAvailability;
  passwordFns: PasswordFunctions;
}

/**
 * Creates all pre-auth singletons: rate limiter, FindWhoIs, throttle handlers,
 * email availability checker, and password functions.
 *
 * These operate outside the DI scope — they use the service-level HandlerContext.
 */
export function createPreAuthHandlers(
  redisSetup: RedisSetup,
  geoClient: ReturnType<typeof import("@d2/geo-client").createGeoServiceClient>,
  geoOptions: GeoClientOptions,
  throttleStore: ISignInThrottleStore,
  db: NodePgDatabase,
  serviceContext: HandlerContext,
  logger: ILogger,
  overridePasswordFns?: PasswordFunctions,
): PreAuthSetup {
  const { handlers } = redisSetup;

  // Rate limiting (Redis-backed distributed sliding window)
  const rateLimitCheck = new CheckRateLimit(
    handlers.getTtl,
    handlers.increment,
    handlers.set,
    {},
    serviceContext,
  );

  // FindWhoIs for request enrichment (WhoIs lookup for IP → city/country)
  const whoIsCacheStore = new CacheMemory.MemoryCacheStore();
  const geoCircuitBreaker = createGeoCircuitBreaker(geoOptions, logger);
  const findWhoIs = new FindWhoIs(
    whoIsCacheStore,
    geoClient,
    geoOptions,
    geoCircuitBreaker,
    serviceContext,
  );

  // Throttle handlers (pre-auth singletons — used in auth routes before BetterAuth)
  const throttleCacheStore = new CacheMemory.MemoryCacheStore();
  const throttleCacheGet = new CacheMemory.Get<boolean>(throttleCacheStore, serviceContext);
  const throttleCacheSet = new CacheMemory.Set<boolean>(throttleCacheStore, serviceContext);
  const throttleCheck = new CheckSignInThrottle(throttleStore, serviceContext, {
    get: throttleCacheGet,
    set: throttleCacheSet,
  });
  const throttleRecord = new RecordSignInOutcome(throttleStore, serviceContext, {
    get: throttleCacheGet,
    set: throttleCacheSet,
  });

  // Email availability check (pre-auth singleton)
  const emailCheckCacheStore = new CacheMemory.MemoryCacheStore();
  const emailCheckCacheGet = new CacheMemory.Get<boolean>(emailCheckCacheStore, serviceContext);
  const emailCheckCacheSet = new CacheMemory.Set<boolean>(emailCheckCacheStore, serviceContext);
  const checkEmailRepo = new CheckEmailAvailabilityRepo(db, serviceContext);
  const checkEmailHandler = new CheckEmailAvailability(checkEmailRepo, serviceContext, {
    get: emailCheckCacheGet,
    set: emailCheckCacheSet,
  });

  // Password policy — HIBP k-anonymity cache + domain validation
  const passwordFns =
    overridePasswordFns ??
    createPasswordFunctions(
      new CacheMemory.MemoryCacheStore({ maxEntries: PASSWORD_POLICY.HIBP_CACHE_MAX_ENTRIES }),
      logger,
    );

  return {
    rateLimitCheck,
    findWhoIs,
    throttleCheck,
    throttleRecord,
    checkEmailHandler,
    passwordFns,
  };
}
