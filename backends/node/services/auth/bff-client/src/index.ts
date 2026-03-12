// @d2/auth-bff-client — Backend-only auth client for SvelteKit BFF pattern.

// --- Types ---
export type { AuthSession, AuthUser, AuthBffConfig } from "./types.js";

// --- Session Resolution ---
export { SessionResolver } from "./session-resolver.js";
export type { SessionResolveResult } from "./session-resolver.js";

// --- JWT Lifecycle ---
export { JwtManager } from "./jwt-manager.js";

// --- Auth Proxy ---
export { AuthProxy } from "./auth-proxy.js";

// --- Route Guards ---
export { requireAuth, requireOrg, redirectIfAuthenticated } from "./route-guard.js";
export type { AuthenticatedLocals, AuthenticatedWithOrgLocals } from "./route-guard.js";
