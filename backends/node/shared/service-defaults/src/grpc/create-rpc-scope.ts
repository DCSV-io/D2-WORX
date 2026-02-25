import type * as grpc from "@grpc/grpc-js";
import { trace } from "@opentelemetry/api";
import type { ServiceProvider, ServiceScope } from "@d2/di";
import { HandlerContext, IHandlerContextKey, IRequestContextKey } from "@d2/handler";
import type { IRequestContext } from "@d2/handler";
import { ILoggerKey } from "@d2/logging";
import { extractGrpcTraceContext } from "./extract-trace-context.js";

/**
 * Options for creating a per-RPC DI scope.
 */
export interface RpcScopeOptions {
  /** Override the default IRequestContext factory (e.g. to extract auth from metadata). */
  createRequestContext?: (
    traceId: string,
    call: grpc.ServerUnaryCall<unknown, unknown>,
  ) => IRequestContext;
}

/**
 * Creates a disposable DI scope with trace context from the incoming gRPC call.
 * Uses the OTel traceId from the propagated context when available, falling back
 * to a fresh UUID for non-instrumented callers.
 *
 * Sets both `IRequestContextKey` and `IHandlerContextKey` on the scope,
 * matching the pattern established by auth scope middleware and comms `createServiceScope`.
 */
export function createRpcScope(
  provider: ServiceProvider,
  call: grpc.ServerUnaryCall<unknown, unknown>,
  options?: RpcScopeOptions,
): ServiceScope {
  const scope = provider.createScope();

  // Use the OTel traceId from the incoming context when available.
  const spanCtx = trace.getSpanContext(extractGrpcTraceContext(call));
  const traceId = spanCtx?.traceId ?? crypto.randomUUID();

  const requestContext: IRequestContext = options?.createRequestContext
    ? options.createRequestContext(traceId, call)
    : {
        traceId,
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
  return scope;
}
