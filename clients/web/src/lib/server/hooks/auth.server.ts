/**
 * SvelteKit Handle wrapper for auth session resolution.
 *
 * Resolves the user session by forwarding cookies to the Auth service's
 * GET /api/auth/get-session endpoint. Sets event.locals.session and
 * event.locals.user for downstream route guards and layouts.
 */
import type { Handle } from "@sveltejs/kit";
import { getAuthContext } from "../auth.server.js";

export function createAuthHandle(): Handle {
  return async ({ event, resolve }) => {
    const ctx = getAuthContext();

    const { session, user } = await ctx.sessionResolver.resolve(event.request);
    event.locals.session = session;
    event.locals.user = user;

    // Update requestInfo with auth state so downstream middleware
    // (idempotency, rate limiting user dimension) can see it
    if (session && event.locals.requestInfo) {
      event.locals.requestInfo.isAuthenticated = true;
      event.locals.requestInfo.userId = session.userId;
    }

    return resolve(event);
  };
}
