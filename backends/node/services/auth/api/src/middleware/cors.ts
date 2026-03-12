import { cors } from "hono/cors";

/**
 * CORS middleware configured for allowed origins.
 * Allows credentials (cookies) and standard auth headers.
 */
export function createCorsMiddleware(origins: string[]) {
  return cors({
    origin: origins,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
  });
}
