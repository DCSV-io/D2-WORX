import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import Redis from "ioredis";
import { drizzle } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result, HttpStatusCode } from "@d2/result";
import { createLogger } from "@d2/logging";
import { HandlerContext } from "@d2/handler";
import * as CacheRedis from "@d2/cache-redis";
import * as CacheMemory from "@d2/cache-memory";
import {
  CreateContacts,
  DeleteContactsByExtKeys,
  FindWhoIs,
  GetContactsByExtKeys,
  UpdateContactsByExtKeys,
  DEFAULT_GEO_CLIENT_OPTIONS,
  type GeoClientOptions,
} from "@d2/geo-client";
import { Check as RateLimitCheck } from "@d2/ratelimit";
import {
  createAuth,
  createSecondaryStorage,
  runMigrations,
  SignInEventRepository,
  EmulationConsentRepository,
  OrgContactRepository,
  type AuthServiceConfig,
} from "@d2/auth-infra";
import {
  createSignInEventHandlers,
  createEmulationConsentHandlers,
  createOrgContactHandlers,
} from "@d2/auth-app";
import { createCorsMiddleware } from "./middleware/cors.js";
import { createSessionMiddleware } from "./middleware/session.js";
import { createCsrfMiddleware } from "./middleware/csrf.js";
import { createRequestEnrichmentMiddleware } from "./middleware/request-enrichment.js";
import { createDistributedRateLimitMiddleware } from "./middleware/distributed-rate-limit.js";
import {
  createSessionFingerprintMiddleware,
  computeFingerprint,
} from "./middleware/session-fingerprint.js";
import { handleError } from "./middleware/error-handler.js";
import { createAuthRoutes } from "./routes/auth-routes.js";
import { createEmulationRoutes } from "./routes/emulation-routes.js";
import { createOrgContactRoutes } from "./routes/org-contact-routes.js";
import { createHealthRoutes } from "./routes/health.js";

/**
 * Creates and wires the complete auth service application.
 *
 * This is the composition root (mirrors .NET Program.cs):
 *   1. Create singletons: pg.Pool, Redis, logger
 *   2. Run Drizzle migrations + create repos
 *   3. Create app-layer handlers: factory functions from auth-app
 *   4. Create AsyncLocalStorage for per-request fingerprint (JWT `fp` claim)
 *   5. Create BetterAuth: configured with all plugins + secondary storage
 *   6. Session fingerprint binding (stolen token detection)
 *   7. Build Hono app: CORS → body limit → enrichment → rate limit → fingerprint → session → CSRF → routes
 *   8. Return app + cleanup function
 */
export async function createApp(config: AuthServiceConfig) {
  // 1. Singletons
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const redis = new Redis(config.redisUrl);
  const logger = createLogger({
    serviceName: config.appName ?? "auth-service",
  });

  // Handler context for custom handlers (service-level, no per-request user)
  const handlerContext = new HandlerContext(
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

  // 2. Run Drizzle migrations + create Drizzle instance for custom tables
  await runMigrations(pool);
  const db = drizzle(pool);

  const signInEventRepo = new SignInEventRepository(db);
  const emulationConsentRepo = new EmulationConsentRepository(db);
  const orgContactRepo = new OrgContactRepository(db);

  // 3. Secondary storage (Redis-backed via @d2/cache-redis handlers)
  const redisGet = new CacheRedis.Get<string>(redis, handlerContext);
  const redisSet = new CacheRedis.Set<string>(redis, handlerContext);
  const redisRemove = new CacheRedis.Remove(redis, handlerContext);
  const secondaryStorage = createSecondaryStorage({
    get: redisGet,
    set: redisSet,
    remove: redisRemove,
  });

  // Rate limiting (Redis-backed distributed sliding window via @d2/ratelimit)
  const redisGetTtl = new CacheRedis.GetTtl(redis, handlerContext);
  const redisIncrement = new CacheRedis.Increment(redis, handlerContext);
  const rateLimitCheck = new RateLimitCheck(redisGetTtl, redisIncrement, redisSet, {}, handlerContext);

  // Helper: checks whether an organization exists in BetterAuth's organization table.
  async function checkOrgExists(orgId: string): Promise<boolean> {
    const result = await pool.query("SELECT 1 FROM organization WHERE id = $1 LIMIT 1", [orgId]);
    return result.rows.length > 0;
  }

  // Geo contact handlers via @d2/geo-client (gRPC-backed with local caching)
  // TODO: Create actual gRPC client via createGeoServiceClient() when Geo service is available.
  // For now, the handlers will fail with SERVICE_UNAVAILABLE (same as before).
  const geoOptions: GeoClientOptions = {
    ...DEFAULT_GEO_CLIENT_OPTIONS,
    allowedContextKeys: ["org_contact"],
    apiKey: config.geoApiKey ?? "",
  };
  const contactCacheStore = new CacheMemory.MemoryCacheStore();
  const geoClient = undefined as never; // Placeholder until Geo gRPC client is wired
  const createContacts = new CreateContacts(geoClient, geoOptions, handlerContext);
  const deleteContactsByExtKeys = new DeleteContactsByExtKeys(
    contactCacheStore,
    geoClient,
    geoOptions,
    handlerContext,
  );
  const getContactsByExtKeys = new GetContactsByExtKeys(
    contactCacheStore,
    geoClient,
    geoOptions,
    handlerContext,
  );
  const updateContactsByExtKeys = new UpdateContactsByExtKeys(
    contactCacheStore,
    geoClient,
    geoOptions,
    handlerContext,
  );

  // FindWhoIs for request enrichment (WhoIs lookup for IP → city/country).
  // Uses same geoClient placeholder — fail-open when Geo gRPC is unavailable.
  // IP + fingerprint enrichment works regardless; city/country dimensions
  // activate once Geo gRPC is connected.
  const whoIsCacheStore = new CacheMemory.MemoryCacheStore();
  const findWhoIs = new FindWhoIs(whoIsCacheStore, geoClient, geoOptions, handlerContext);

  // In-memory cache for sign-in event queries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type SignInEventCacheValue = { events: any[]; total: number; latestDate: string | null };
  const signInEventCacheStore = new CacheMemory.MemoryCacheStore();
  const signInEventCacheGet = new CacheMemory.Get<SignInEventCacheValue>(
    signInEventCacheStore,
    handlerContext,
  );
  const signInEventCacheSet = new CacheMemory.Set<SignInEventCacheValue>(
    signInEventCacheStore,
    handlerContext,
  );

  // 4. App-layer handlers
  const signInEventHandlers = createSignInEventHandlers(signInEventRepo, handlerContext, {
    get: signInEventCacheGet,
    set: signInEventCacheSet,
  });
  const emulationConsentHandlers = createEmulationConsentHandlers(
    emulationConsentRepo,
    handlerContext,
    checkOrgExists,
  );
  const orgContactHandlers = createOrgContactHandlers(orgContactRepo, handlerContext, {
    createContacts,
    deleteContactsByExtKeys,
    updateContactsByExtKeys,
    getContactsByExtKeys,
  });

  // 5. AsyncLocalStorage for per-request fingerprint (used by JWT definePayload)
  const fingerprintStorage = new AsyncLocalStorage<string>();

  // 6. BetterAuth instance with app-layer callbacks
  const auth = createAuth(config, db, secondaryStorage, {
    onSignIn: async (data) => {
      await signInEventHandlers.record.handleAsync({
        userId: data.userId,
        successful: true,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
    },
    getFingerprintForCurrentRequest: () => fingerprintStorage.getStore(),
  });

  // 7. Session fingerprint binding (stolen token detection)
  const SESSION_FP_PREFIX = "session:fp:";
  const SESSION_FP_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (matches session expiry)

  const sessionFingerprintMiddleware = createSessionFingerprintMiddleware({
    storeFingerprint: async (token, fp) => {
      await redis.set(`${SESSION_FP_PREFIX}${token}`, fp, "EX", SESSION_FP_TTL_SECONDS);
    },
    getFingerprint: async (token) => {
      return redis.get(`${SESSION_FP_PREFIX}${token}`);
    },
    revokeSession: async (token) => {
      // Remove fingerprint key
      await redis.del(`${SESSION_FP_PREFIX}${token}`);
      // Revoke via BetterAuth — invalidates the session in DB + Redis
      await auth.api.revokeSession({
        headers: new Headers(),
        body: { token },
      });
    },
  });

  // 8. Build Hono app
  const app = new Hono();

  // Global middleware
  app.use("*", createCorsMiddleware(config.corsOrigin));
  app.use(
    "*",
    bodyLimit({
      maxSize: 256 * 1024, // 256 KB — auth payloads are small JSON
      onError: (c) =>
        c.json(
          D2Result.fail({
            messages: ["Request body too large."],
            statusCode: HttpStatusCode.BadRequest,
          }),
          413 as ContentfulStatusCode,
        ),
    }),
  );
  app.use("*", createRequestEnrichmentMiddleware(findWhoIs, undefined, logger));
  app.use("*", createDistributedRateLimitMiddleware(rateLimitCheck));
  app.onError(handleError);

  // Health (no auth required)
  app.route("/", createHealthRoutes());

  // BetterAuth routes (handles its own auth)
  // Fingerprint check on auth routes — catches stolen tokens on sign-in.
  // AsyncLocalStorage middleware: stores the request fingerprint so that
  // BetterAuth's definePayload callback can embed it as the JWT `fp` claim.
  const authApp = new Hono();
  authApp.use("*", sessionFingerprintMiddleware);
  authApp.use("*", async (c, next) => {
    const fp = computeFingerprint(c.req.raw.headers);
    await fingerprintStorage.run(fp, () => next());
  });
  authApp.route("/", createAuthRoutes(auth));
  app.route("/", authApp);

  // Protected custom routes: session + fingerprint + CSRF
  const protectedRoutes = new Hono();
  protectedRoutes.use("*", createSessionMiddleware(auth));
  protectedRoutes.use("*", sessionFingerprintMiddleware);
  protectedRoutes.use("*", createCsrfMiddleware(config.corsOrigin));
  protectedRoutes.route("/", createEmulationRoutes(emulationConsentHandlers));
  protectedRoutes.route("/", createOrgContactRoutes(orgContactHandlers));
  app.route("/", protectedRoutes);

  // Cleanup function for graceful shutdown
  async function shutdown() {
    redis.disconnect();
    await pool.end();
  }

  return { app, auth, shutdown };
}
