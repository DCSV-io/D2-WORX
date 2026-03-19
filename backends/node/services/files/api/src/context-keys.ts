/**
 * Hono context variable keys — centralized for maintainability.
 */
export const SCOPE_KEY = "scope" as const;
export const REQUEST_CONTEXT_KEY = "requestContext" as const;
export const REQUEST_LOGGER_KEY = "requestLogger" as const;
/** Enriched context from request-enrichment middleware (preserved before JWT overwrites). */
export const ENRICHED_CONTEXT_KEY = "enrichedContext" as const;
