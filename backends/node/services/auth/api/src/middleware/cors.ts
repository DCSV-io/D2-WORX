import { cors } from "hono/cors";

/**
 * CORS middleware configured for SvelteKit origin.
 * Allows credentials (cookies) and standard auth headers.
 */
export function createCorsMiddleware(origin: string) {
  return cors({
    origin,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
  });
}
