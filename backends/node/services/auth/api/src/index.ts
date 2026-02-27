// @d2/auth-api — Hono server entry point and DI composition root.

export { createApp } from "./composition-root.js";
export type { AppOverrides } from "./composition-root.js";
export type { SessionVariables } from "./middleware/session.js";

// Context key constants
export { USER_KEY, SESSION_KEY, SCOPE_KEY, REQUEST_INFO_KEY } from "./context-keys.js";

// Middleware factories (exported for testing)
export { createCsrfMiddleware } from "./middleware/csrf.js";
export { createRequestEnrichmentMiddleware } from "./middleware/request-enrichment.js";
export { createDistributedRateLimitMiddleware } from "./middleware/distributed-rate-limit.js";
export { createSessionMiddleware } from "./middleware/session.js";
export {
  createSessionFingerprintMiddleware,
  computeFingerprint,
  type SessionFingerprintOptions,
  type StoreFingerprint,
  type GetFingerprint,
  type RevokeSession,
} from "./middleware/session-fingerprint.js";
export { handleError } from "./middleware/error-handler.js";
export { createServiceKeyMiddleware } from "./middleware/service-key.js";
export { createScopeMiddleware } from "./middleware/scope.js";
export {
  requireOrg,
  requireOrgType,
  requireRole,
  requireStaff,
  requireAdmin,
} from "./middleware/authorization.js";

// Route factories (exported for testing)
export { createAuthRoutes } from "./routes/auth-routes.js";
export { createEmulationRoutes } from "./routes/emulation-routes.js";
export { createOrgContactRoutes } from "./routes/org-contact-routes.js";
export { createInvitationRoutes } from "./routes/invitation-routes.js";
export { createHealthRoutes } from "./routes/health.js";
