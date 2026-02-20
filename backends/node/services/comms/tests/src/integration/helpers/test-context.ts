import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";

export function createTestContext(): HandlerContext {
  const request: IRequestContext = {
    traceId: "trace-integration",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}
