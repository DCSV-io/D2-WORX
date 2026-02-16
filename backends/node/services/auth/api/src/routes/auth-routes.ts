import { Hono } from "hono";
import type { Auth } from "@d2/auth-infra";

/**
 * Clones response headers and appends a single header.
 */
function appendHeader(original: Headers, key: string, value: string): Headers {
  const headers = new Headers(original);
  headers.set(key, value);
  return headers;
}

/**
 * Mounts BetterAuth at /api/auth/*.
 *
 * All BetterAuth endpoints (sign-up, sign-in, session, JWKS, org, etc.)
 * are handled by auth.handler, which processes the raw Request and returns
 * a Response.
 */
export function createAuthRoutes(auth: Auth) {
  const app = new Hono();

  app.all("/api/auth/*", async (c) => {
    const response = await auth.handler(c.req.raw);

    // Add Cache-Control on JWKS/discovery responses.
    // Keys rotate every 30 days — 1 hour cache is conservative.
    // Reduces upstream fetches from .NET gateway and intermediate proxies.
    if (c.req.path.includes(".well-known/")) {
      return new Response(response.body, {
        status: response.status,
        headers: appendHeader(response.headers, "Cache-Control", "public, max-age=3600"),
      });
    }

    return response;
  });

  return app;
}
