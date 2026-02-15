// @d2/auth-api — Hono server entry point and DI composition root.

export { createApp } from "./composition-root.js";
export type { SessionVariables } from "./middleware/session.js";

// Middleware factories (exported for testing)
export { createCsrfMiddleware } from "./middleware/csrf.js";
export { createRateLimitMiddleware } from "./middleware/rate-limit.js";
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
export {
  requireOrg,
  requireOrgType,
  requireRole,
  requireStaff,
  requireAdmin,
} from "./middleware/authorization.js";

// Route factories (exported for testing)
export { createEmulationRoutes } from "./routes/emulation-routes.js";
export { createOrgContactRoutes } from "./routes/org-contact-routes.js";
export { createHealthRoutes } from "./routes/health.js";
