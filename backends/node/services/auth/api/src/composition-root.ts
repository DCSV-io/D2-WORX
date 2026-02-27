import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import Redis from "ioredis";
import { drizzle } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result } from "@d2/result";
import { ServiceCollection } from "@d2/di";
import { createLogger } from "@d2/logging";
import { ILoggerKey } from "@d2/logging";
import {
  HandlerContext,
  IHandlerContextKey,
  IRequestContextKey,
  createServiceScope,
} from "@d2/handler";
import * as CacheRedis from "@d2/cache-redis";
import { PingMessageBus, IMessageBusPingKey } from "@d2/messaging";
import * as CacheMemory from "@d2/cache-memory";
import {
  CreateContacts,
  DeleteContactsByExtKeys,
  FindWhoIs,
  GetContactsByExtKeys,
  UpdateContactsByExtKeys,
  ICreateContactsKey,
  IDeleteContactsByExtKeysKey,
  IGetContactsByExtKeysKey,
  IUpdateContactsByExtKeysKey,
  DEFAULT_GEO_CLIENT_OPTIONS,
  createGeoServiceClient,
  type GeoClientOptions,
} from "@d2/geo-client";
import { addCommsClient, INotifyKey } from "@d2/comms-client";
import type { IMessagePublisher } from "@d2/messaging";
import { Check as RateLimitCheck } from "@d2/ratelimit";
import {
  createAuth,
  createSecondaryStorage,
  createPasswordFunctions,
  runMigrations,
  addAuthInfra,
  SignInThrottleStore,
  createWhoIsResolutionConsumer,
  type AuthServiceConfig,
  type PasswordFunctions,
} from "@d2/auth-infra";
import { PASSWORD_POLICY, GEO_CONTEXT_KEYS, AUTH_MESSAGING } from "@d2/auth-domain";
import {
  addAuthApp,
  ISignInThrottleStoreKey,
  IRecordSignInEventKey,
  ICreateUserContactKey,
  CheckSignInThrottle,
  RecordSignInOutcome,
} from "@d2/auth-app";
import { createCorsMiddleware } from "./middleware/cors.js";
import { createSessionMiddleware } from "./middleware/session.js";
import { createCsrfMiddleware } from "./middleware/csrf.js";
import { createRequestEnrichmentMiddleware } from "./middleware/request-enrichment.js";
import { createDistributedRateLimitMiddleware } from "./middleware/distributed-rate-limit.js";
import { createServiceKeyMiddleware } from "./middleware/service-key.js";
import {
  createSessionFingerprintMiddleware,
  computeFingerprint,
} from "./middleware/session-fingerprint.js";
import { createScopeMiddleware } from "./middleware/scope.js";
import { handleError } from "./middleware/error-handler.js";
import { createAuthRoutes } from "./routes/auth-routes.js";
import { createEmulationRoutes } from "./routes/emulation-routes.js";
import { createOrgContactRoutes } from "./routes/org-contact-routes.js";
import { createInvitationRoutes } from "./routes/invitation-routes.js";
import { createHealthRoutes } from "./routes/health.js";

/**
 * Optional overrides for the composition root.
 * Primarily used by tests to replace infrastructure dependencies.
 */
export interface AppOverrides {
  /** Custom password hash/verify — skips HIBP breach check when provided. */
  passwordFunctions?: PasswordFunctions;
}

/**
 * Creates and wires the complete auth service application.
 *
 * This is the composition root (mirrors .NET Program.cs):
 *   1. Create singletons: pg.Pool, Redis, logger
 *   2. Run Drizzle migrations + create repos via DI
 *   3. Register all services in ServiceCollection
 *   4. Build ServiceProvider
 *   5. Create pre-auth singletons (FindWhoIs, RateLimit, Throttle)
 *   6. Create BetterAuth with scoped callbacks
 *   7. Build Hono app with scope middleware on protected routes
 */
export async function createApp(
  config: AuthServiceConfig & { authApiKeys?: string[] },
  publisher?: IMessagePublisher,
  overrides?: AppOverrides,
  messageBus?: import("@d2/messaging").MessageBus,
) {
  // 1. Singletons (infrastructure)
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const redis = new Redis(config.redisUrl);
  const logger = createLogger({
    serviceName: config.appName ?? "auth-service",
  });

  // Service-level HandlerContext for pre-auth handlers (no per-request user info)
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

  // 2. Run Drizzle migrations + create Drizzle instance
  await runMigrations(pool);
  const db = drizzle(pool);

  // 3. Build ServiceCollection (mirrors .NET Program.cs)
  const services = new ServiceCollection();

  // Logger — singleton (pre-built instance)
  services.addInstance(ILoggerKey, logger);

  // IHandlerContext — scoped (new per request, built from IRequestContext + logger)
  services.addScoped(
    IHandlerContextKey,
    (sp) => new HandlerContext(sp.resolve(IRequestContextKey), sp.resolve(ILoggerKey)),
  );

  // Secondary storage (Redis-backed via @d2/cache-redis handlers)
  const redisGet = new CacheRedis.Get<string>(redis, serviceContext);
  const redisSet = new CacheRedis.Set<string>(redis, serviceContext);
  const redisRemove = new CacheRedis.Remove(redis, serviceContext);
  const secondaryStorage = createSecondaryStorage({
    get: redisGet,
    set: redisSet,
    remove: redisRemove,
  });

  // Sign-in throttle store (Redis-backed)
  const redisExists = new CacheRedis.Exists(redis, serviceContext);
  const redisGetTtl = new CacheRedis.GetTtl(redis, serviceContext);
  const redisIncrement = new CacheRedis.Increment(redis, serviceContext);
  const throttleStore = new SignInThrottleStore(
    redisExists,
    redisGetTtl,
    redisSet,
    redisRemove,
    redisIncrement,
  );
  services.addInstance(ISignInThrottleStoreKey, throttleStore);

  // Helper: checks whether an organization exists in BetterAuth's organization table.
  async function checkOrgExists(orgId: string): Promise<boolean> {
    const result = await pool.query("SELECT 1 FROM organization WHERE id = $1 LIMIT 1", [orgId]);
    return result.rows.length > 0;
  }

  // Geo contact handlers (gRPC-backed with local caching)
  const geoOptions: GeoClientOptions = {
    ...DEFAULT_GEO_CLIENT_OPTIONS,
    allowedContextKeys: [
      GEO_CONTEXT_KEYS.ORG_CONTACT,
      GEO_CONTEXT_KEYS.USER,
      GEO_CONTEXT_KEYS.ORG_INVITATION,
    ],
    apiKey: config.geoApiKey ?? "",
  };
  const contactCacheStore = new CacheMemory.MemoryCacheStore();
  if (!config.geoAddress || !config.geoApiKey) {
    logger.warn(
      "Geo gRPC client not configured (missing GEO_GRPC_ADDRESS or API key) — contact/WhoIs operations will fail",
    );
  }
  const geoClient =
    config.geoAddress && config.geoApiKey
      ? createGeoServiceClient(config.geoAddress, config.geoApiKey)
      : (undefined as never);

  // Register geo-client handlers as singleton instances (share cache stores)
  const createContacts = new CreateContacts(geoClient, geoOptions, serviceContext);
  const deleteContactsByExtKeys = new DeleteContactsByExtKeys(
    contactCacheStore,
    geoClient,
    geoOptions,
    serviceContext,
  );
  const getContactsByExtKeys = new GetContactsByExtKeys(
    contactCacheStore,
    geoClient,
    geoOptions,
    serviceContext,
  );
  const updateContactsByExtKeys = new UpdateContactsByExtKeys(
    contactCacheStore,
    geoClient,
    geoOptions,
    serviceContext,
  );
  services.addInstance(ICreateContactsKey, createContacts);
  services.addInstance(IDeleteContactsByExtKeysKey, deleteContactsByExtKeys);
  services.addInstance(IGetContactsByExtKeysKey, getContactsByExtKeys);
  services.addInstance(IUpdateContactsByExtKeysKey, updateContactsByExtKeys);

  // Layer registrations (mirrors services.AddAuthInfra(), services.AddAuthApp())
  addAuthInfra(services, db);
  addAuthApp(services, { checkOrgExists });
  addCommsClient(services, { publisher });

  // Shared health check handlers (cache + messaging)
  services.addInstance(CacheRedis.ICachePingKey, new CacheRedis.PingCache(redis, serviceContext));
  if (messageBus) {
    services.addInstance(IMessageBusPingKey, new PingMessageBus(messageBus, serviceContext));
  }

  // 4. Build ServiceProvider
  const provider = services.build();

  // 5. Pre-auth singletons (not in DI — use service-level context)
  // Rate limiting (Redis-backed distributed sliding window via @d2/ratelimit)
  const rateLimitCheck = new RateLimitCheck(
    redisGetTtl,
    redisIncrement,
    redisSet,
    {},
    serviceContext,
  );

  // FindWhoIs for request enrichment (WhoIs lookup for IP → city/country)
  const whoIsCacheStore = new CacheMemory.MemoryCacheStore();
  const findWhoIs = new FindWhoIs(whoIsCacheStore, geoClient, geoOptions, serviceContext);

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

  // 6. Password policy — HIBP k-anonymity cache + domain validation
  const passwordFns =
    overrides?.passwordFunctions ??
    createPasswordFunctions(
      new CacheMemory.MemoryCacheStore({ maxEntries: PASSWORD_POLICY.HIBP_CACHE_MAX_ENTRIES }),
      logger,
    );

  // AsyncLocalStorage for per-request fingerprint (used by JWT definePayload)
  const fingerprintStorage = new AsyncLocalStorage<string>();

  /**
   * Creates a temporary DI scope for BetterAuth callback handlers.
   * These fire during request processing but outside the scope middleware.
   */
  const createCallbackScope = () => createServiceScope(provider, logger);

  // User contact handler for sign-up → Geo contact creation.
  const geoConfigured = !!(config.geoAddress && config.geoApiKey);

  // 7. BetterAuth instance with scoped callbacks
  const auth = createAuth(config, db, secondaryStorage, {
    onSignIn: async (data) => {
      const scope = createCallbackScope();
      try {
        const handler = scope.resolve(IRecordSignInEventKey);
        const result = await handler.handleAsync({
          userId: data.userId,
          successful: true,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });

        // Fire-and-forget: publish to WhoIs resolution queue for async enrichment
        if (result.success && result.data?.event && publisher) {
          publisher
            .send(
              {
                exchange: AUTH_MESSAGING.WHOIS_RESOLUTION_EXCHANGE,
                routingKey: AUTH_MESSAGING.WHOIS_RESOLUTION_QUEUE,
              },
              {
                signInEventId: result.data.event.id,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
              },
            )
            .catch(() => {}); // Fail-open: ipAddress already persisted
        }
      } finally {
        scope.dispose();
      }
    },
    getFingerprintForCurrentRequest: () => fingerprintStorage.getStore(),
    passwordFunctions: passwordFns,
    publishVerificationEmail: async (input) => {
      const scope = createCallbackScope();
      try {
        // Resolve contactId from userId via geo-client (cached)
        const result = await getContactsByExtKeys.handleAsync({
          keys: [{ contextKey: GEO_CONTEXT_KEYS.USER, relatedEntityId: input.userId }],
        });
        const lookupKey = `${GEO_CONTEXT_KEYS.USER}:${input.userId}`;
        const contactId = result.data?.data.get(lookupKey)?.[0]?.id;
        if (!contactId) {
          logger.error(
            `No Geo contact found for user ${input.userId} — cannot send verification email`,
          );
          return;
        }

        const notifier = scope.resolve(INotifyKey);
        await notifier.handleAsync({
          recipientContactId: contactId,
          title: "Verify your email address",
          content: `Hi ${input.name},\n\nPlease verify your email by clicking the link below:\n\n[Verify Email](${input.verificationUrl})`,
          plaintext: `Hi ${input.name}, please verify your email by visiting: ${input.verificationUrl}`,
          sensitive: true,
          correlationId: crypto.randomUUID(),
          senderService: "auth",
        });
      } finally {
        scope.dispose();
      }
    },
    publishPasswordReset: async (input) => {
      const scope = createCallbackScope();
      try {
        // Resolve contactId from userId via geo-client (cached)
        const result = await getContactsByExtKeys.handleAsync({
          keys: [{ contextKey: GEO_CONTEXT_KEYS.USER, relatedEntityId: input.userId }],
        });
        const lookupKey = `${GEO_CONTEXT_KEYS.USER}:${input.userId}`;
        const contactId = result.data?.data.get(lookupKey)?.[0]?.id;
        if (!contactId) {
          logger.error(
            `No Geo contact found for user ${input.userId} — cannot send password reset`,
          );
          return;
        }

        const notifier = scope.resolve(INotifyKey);
        await notifier.handleAsync({
          recipientContactId: contactId,
          title: "Reset your password",
          content: `Hi ${input.name},\n\nYou requested a password reset. Click the link below to set a new password:\n\n[Reset Password](${input.resetUrl})\n\nIf you didn't request this, you can safely ignore this email.`,
          plaintext: `Hi ${input.name}, reset your password by visiting: ${input.resetUrl}. If you didn't request this, ignore this email.`,
          sensitive: true,
          correlationId: crypto.randomUUID(),
          senderService: "auth",
        });
      } finally {
        scope.dispose();
      }
    },
    createUserContact: geoConfigured
      ? async (data) => {
          const scope = createCallbackScope();
          try {
            const handler = scope.resolve(ICreateUserContactKey);
            const result = await handler.handleAsync(data);
            if (!result.success) {
              throw new Error(
                `Failed to create Geo contact for user ${data.userId}: ${result.messages?.join(", ") ?? "unknown error"}`,
              );
            }
          } finally {
            scope.dispose();
          }
        }
      : undefined,
  });

  // 8. Session fingerprint binding (stolen token detection)
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
      await redis.del(`${SESSION_FP_PREFIX}${token}`);
      await auth.api.revokeSession({
        headers: new Headers(),
        body: { token },
      });
    },
  });

  // 9. Build Hono app
  const app = new Hono();

  // Global middleware
  app.use("*", createCorsMiddleware(config.corsOrigin));
  app.use("*", async (c, next) => {
    await next();
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("X-Frame-Options", "DENY");
  });
  app.use(
    "*",
    bodyLimit({
      maxSize: 256 * 1024, // 256 KB — auth payloads are small JSON
      onError: (c) =>
        c.json(
          D2Result.payloadTooLarge({
            messages: ["Request body too large."],
          }),
          413 as ContentfulStatusCode,
        ),
    }),
  );
  app.use("*", createRequestEnrichmentMiddleware(findWhoIs, undefined, logger));
  if (config.authApiKeys?.length) {
    app.use("*", createServiceKeyMiddleware(new Set(config.authApiKeys)));
    logger.info(
      `Auth API service key authentication enabled (${config.authApiKeys.length} key(s))`,
    );
  }
  app.use("*", createDistributedRateLimitMiddleware(rateLimitCheck));
  app.onError(handleError);

  // Health (no auth required)
  app.route("/", createHealthRoutes(provider));

  // BetterAuth routes (handles its own auth)
  // Fingerprint + AsyncLocalStorage for JWT `fp` claim
  const authApp = new Hono();
  authApp.use("*", sessionFingerprintMiddleware);
  authApp.use("*", async (c, next) => {
    const fp = computeFingerprint(c.req.raw.headers);
    await fingerprintStorage.run(fp, () => next());
  });
  authApp.route("/", createAuthRoutes(auth, { check: throttleCheck, record: throttleRecord }));
  app.route("/", authApp);

  // Protected custom routes: session + fingerprint + scope + CSRF → routes resolve from scope
  const protectedRoutes = new Hono();
  protectedRoutes.use("*", createSessionMiddleware(auth));
  protectedRoutes.use("*", sessionFingerprintMiddleware);
  protectedRoutes.use("*", createScopeMiddleware(provider));
  protectedRoutes.use("*", createCsrfMiddleware(config.corsOrigin));
  protectedRoutes.route("/", createEmulationRoutes());
  protectedRoutes.route("/", createOrgContactRoutes());
  protectedRoutes.route("/", createInvitationRoutes(auth, db, config.baseUrl));
  app.route("/", protectedRoutes);

  // WhoIs resolution consumer (self-consume: resolves WhoIs for sign-in events)
  if (messageBus) {
    createWhoIsResolutionConsumer({
      messageBus,
      provider,
      createScope: createServiceScope,
      findWhoIs,
      logger,
    });
  }

  // Cleanup function for graceful shutdown
  async function shutdown() {
    provider.dispose();
    redis.disconnect();
    await pool.end();
  }

  return { app, auth, shutdown };
}
