import { Hono } from "hono";
import type { Auth } from "@d2/auth-infra";

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
    return response;
  });

  return app;
}
