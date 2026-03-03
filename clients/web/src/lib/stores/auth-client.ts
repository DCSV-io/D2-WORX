/**
 * Client-side BetterAuth client for browser-side auth operations.
 *
 * Used for sign-in/sign-up form submissions, sign-out, and reactive
 * session state. All requests are proxied through SvelteKit's
 * /api/auth/* catch-all route to the Auth service.
 *
 * NOT used for server-side session resolution — that goes through
 * @d2/auth-bff-client's SessionResolver.
 */
import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient({
  baseURL: "/api/auth",
});
