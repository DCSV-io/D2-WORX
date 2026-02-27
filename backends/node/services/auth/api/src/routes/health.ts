import { Hono } from "hono";
import type { ServiceProvider } from "@d2/di";
import { HandlerContext, IHandlerContextKey, IRequestContextKey } from "@d2/handler";
import { ILoggerKey } from "@d2/logging";
import { ICheckHealthKey } from "@d2/auth-app";

/**
 * Health check endpoint — resolves CheckHealth handler from DI to ping
 * all dependencies (DB, cache, messaging) with OTel tracing.
 */
export function createHealthRoutes(provider: ServiceProvider) {
  const app = new Hono();

  app.get("/health-rich", async (c) => {
    const scope = provider.createScope();
    try {
      const requestContext = {
        traceId: crypto.randomUUID(),
        isAuthenticated: false,
        isAgentStaff: false,
        isAgentAdmin: false,
        isTargetingStaff: false,
        isTargetingAdmin: false,
        isOrgEmulating: false,
        isUserImpersonating: false,
      };
      scope.setInstance(IRequestContextKey, requestContext);
      scope.setInstance(
        IHandlerContextKey,
        new HandlerContext(requestContext, provider.resolve(ILoggerKey)),
      );

      const handler = scope.resolve(ICheckHealthKey);
      const result = await handler.handleAsync({});

      const status = result.data?.status === "healthy" ? 200 : 503;
      return c.json(
        {
          status: result.data?.status ?? "unhealthy",
          timestamp: new Date().toISOString(),
          components: result.data?.components ?? {},
        },
        status as 200,
      );
    } finally {
      scope.dispose();
    }
  });

  return app;
}
