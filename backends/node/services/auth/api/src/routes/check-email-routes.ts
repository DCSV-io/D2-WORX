import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result } from "@d2/result";
import type { CheckEmailAvailability } from "@d2/auth-app";

/**
 * Public route for checking email availability during sign-up.
 *
 * Mounted BEFORE BetterAuth routes so rate limiting still applies
 * but no session/CSRF middleware is needed.
 */
export function createCheckEmailRoutes(handler: CheckEmailAvailability) {
  const app = new Hono();

  app.get("/api/auth/check-email", async (c) => {
    const email = c.req.query("email");
    if (!email) {
      return c.json(
        D2Result.fail({ messages: ["Email query parameter is required."], statusCode: 400 }),
        400 as ContentfulStatusCode,
      );
    }

    const result = await handler.handleAsync({ email });
    const status = result.success ? 200 : (result.statusCode ?? 400);
    return c.json(result, status as ContentfulStatusCode);
  });

  return app;
}
