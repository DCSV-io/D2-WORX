import { AsyncLocalStorage } from "node:async_hooks";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result } from "@d2/result";
import type { ServiceProvider } from "@d2/di";
import type { ILogger } from "@d2/logging";
import type { FindWhoIs } from "@d2/geo-client";
import type { CheckRateLimit } from "@d2/ratelimit";
import type { CheckSignInThrottle, RecordSignInOutcome, CheckEmailAvailability } from "@d2/auth-app";
import type { Auth } from "@d2/auth-infra";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createCorsMiddleware } from "../middleware/cors.js";
import { createSessionMiddleware } from "../middleware/session.js";
import { createCsrfMiddleware } from "../middleware/csrf.js";
import { createRequestEnrichmentMiddleware } from "../middleware/request-enrichment.js";
import { createDistributedRateLimitMiddleware } from "../middleware/distributed-rate-limit.js";
import { createServiceKeyMiddleware } from "../middleware/service-key.js";
import {
  createSessionFingerprintMiddleware,
  computeFingerprint,
} from "../middleware/session-fingerprint.js";
import { createScopeMiddleware } from "../middleware/scope.js";
import { handleError } from "../middleware/error-handler.js";
import { createAuthRoutes } from "../routes/auth-routes.js";
import { createEmulationRoutes } from "../routes/emulation-routes.js";
import { createOrgContactRoutes } from "../routes/org-contact-routes.js";
import { createInvitationRoutes } from "../routes/invitation-routes.js";
import { createCheckEmailRoutes } from "../routes/check-email-routes.js";

export interface HonoAppOptions {
  auth: Auth;
  provider: ServiceProvider;
  config: {
    corsOrigins: string[];
    authApiKeys?: string[];
    baseUrl: string;
  };
  findWhoIs: FindWhoIs;
  rateLimitCheck: CheckRateLimit;
  throttleCheck: CheckSignInThrottle;
  throttleRecord: RecordSignInOutcome;
  checkEmailHandler: CheckEmailAvailability;
  fingerprintStorage: AsyncLocalStorage<string>;
  sessionFingerprintMiddleware: ReturnType<typeof createSessionFingerprintMiddleware>;
  logger: ILogger;
  db: NodePgDatabase;
}

/**
 * Builds the Hono app with all middleware and route composition.
 */
export function buildHonoApp(options: HonoAppOptions): Hono {
  const {
    auth,
    provider,
    config,
    findWhoIs,
    rateLimitCheck,
    throttleCheck,
    throttleRecord,
    checkEmailHandler,
    fingerprintStorage,
    sessionFingerprintMiddleware,
    logger,
    db,
  } = options;

  const app = new Hono();

  // Global middleware
  app.use("*", createCorsMiddleware(config.corsOrigins));
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

  // Email availability check (public, pre-auth — rate limited but no session/CSRF)
  app.route("/", createCheckEmailRoutes(checkEmailHandler));

  // BetterAuth routes (handles its own auth)
  // Fingerprint + AsyncLocalStorage for JWT `fp` claim
  const authApp = new Hono();
  authApp.use("*", sessionFingerprintMiddleware);
  authApp.use("*", async (c, next) => {
    const fp = computeFingerprint(c.req.raw.headers);
    await fingerprintStorage.run(fp, () => next());
  });
  authApp.route(
    "/",
    createAuthRoutes(auth, { check: throttleCheck, record: throttleRecord }, logger),
  );
  app.route("/", authApp);

  // Protected custom routes: session + fingerprint + scope + CSRF → routes resolve from scope
  const protectedRoutes = new Hono();
  protectedRoutes.use("*", createSessionMiddleware(auth));
  protectedRoutes.use("*", sessionFingerprintMiddleware);
  protectedRoutes.use("*", createScopeMiddleware(provider));
  protectedRoutes.use("*", createCsrfMiddleware(config.corsOrigins));
  protectedRoutes.route("/", createEmulationRoutes());
  protectedRoutes.route("/", createOrgContactRoutes());
  protectedRoutes.route("/", createInvitationRoutes(auth, db, config.baseUrl));
  app.route("/", protectedRoutes);

  return app;
}
