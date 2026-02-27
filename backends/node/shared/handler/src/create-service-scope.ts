import type { ServiceProvider, ServiceScope } from "@d2/di";
import type { ILogger } from "@d2/logging";
import { ILoggerKey } from "@d2/logging";
import { HandlerContext } from "./handler-context.js";
import { IHandlerContextKey, IRequestContextKey } from "./service-keys.js";
import type { IRequestContext } from "./i-request-context.js";

/**
 * Creates a disposable DI scope with a fresh traceId and no auth context.
 * Used for per-RPC, per-message, callback, and startup operations.
 *
 * This extracts the common pattern from Auth's createCallbackScope and Comms' createServiceScope.
 *
 * @param provider - The root ServiceProvider to create a scope from.
 * @param logger - Optional logger override. If not provided, resolves ILoggerKey from the provider.
 */
export function createServiceScope(provider: ServiceProvider, logger?: ILogger): ServiceScope {
  const scope = provider.createScope();
  const requestContext: IRequestContext = {
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
  const resolvedLogger = logger ?? provider.resolve(ILoggerKey);
  scope.setInstance(IHandlerContextKey, new HandlerContext(requestContext, resolvedLogger));
  return scope;
}
