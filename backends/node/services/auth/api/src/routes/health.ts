import { Hono } from "hono";

/**
 * Health check endpoint.
 */
export function createHealthRoutes() {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  return app;
}
