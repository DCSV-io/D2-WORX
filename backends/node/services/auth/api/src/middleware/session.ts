import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result } from "@d2/result";
import type { Auth } from "@d2/auth-infra";
import { USER_KEY, SESSION_KEY } from "../context-keys.js";

/**
 * Hono Variables set by the session middleware.
 */
export interface SessionVariables {
  user: { id: string; email: string; name: string } | null;
  session: Record<string, unknown> | null;
}

/**
 * Session middleware that extracts user and session from BetterAuth.
 *
 * Sets c.var.user and c.var.session for downstream route handlers.
 * Rejects unauthenticated requests with 401 — routes can trust that
 * user and session are non-null when this middleware is applied.
 *
 * Infrastructure errors (Redis down, DB outage) return 503 instead of
 * silently treating the user as unauthenticated.
 */
export function createSessionMiddleware(auth: Auth) {
  return createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
    let session;
    try {
      session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
    } catch {
      // Infrastructure failure — do NOT silently degrade to unauthenticated
      return c.json(
        D2Result.fail({
          messages: ["Service temporarily unavailable. Please try again."],
          statusCode: 503,
        }),
        503 as ContentfulStatusCode,
      );
    }

    if (!session) {
      return c.json(D2Result.unauthorized(), 401 as ContentfulStatusCode);
    }

    c.set(USER_KEY, session.user as SessionVariables["user"]);
    c.set(SESSION_KEY, session.session as unknown as Record<string, unknown>);

    await next();
  });
}
