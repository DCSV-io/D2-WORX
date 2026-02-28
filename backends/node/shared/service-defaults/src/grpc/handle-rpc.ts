import * as grpc from "@grpc/grpc-js";
import type { ServiceKey, ServiceProvider } from "@d2/di";
import type { D2Result } from "@d2/result";
import { createRpcScope, type RpcScopeOptions } from "./create-rpc-scope.js";
import { withTraceContext } from "./with-trace-context.js";

/**
 * Minimal handler shape for generic RPC resolution.
 * Matches the {@link @d2/handler#IHandler} interface without requiring that import.
 */
type RpcHandler<TInput, TOutput> = {
  handleAsync(input: TInput): Promise<D2Result<TOutput | undefined>>;
};

/**
 * Configuration for a generic gRPC unary handler.
 *
 * @typeParam TRequest  - Proto request type (from `call.request`).
 * @typeParam TResponse - Proto response type (sent via `callback`).
 * @typeParam TInput    - Handler input type (domain layer).
 * @typeParam TOutput   - Handler output type (domain layer).
 */
export interface HandleRpcOptions<TRequest, TResponse, TInput, TOutput> {
  /** DI key for the handler to resolve from the per-RPC scope. */
  readonly handlerKey: ServiceKey<RpcHandler<TInput, TOutput>>;

  /** Maps the proto request to the handler's input type. */
  readonly mapInput: (request: TRequest) => TInput;

  /** Maps the handler's D2Result to the proto response type. */
  readonly mapResponse: (result: D2Result<TOutput | undefined>) => TResponse;

  /** Optional scope creation overrides (e.g. custom IRequestContext factory). */
  readonly scopeOptions?: RpcScopeOptions;
}

/**
 * General-purpose gRPC unary handler with standard boilerplate:
 * trace-context propagation, DI scope creation, handler resolution,
 * input/output mapping, error handling, and scope disposal.
 *
 * Use this for regular (non-job) RPCs. For scheduled jobs, prefer
 * {@link handleJobRpc} which provides additional job-specific defaults.
 *
 * @example
 * ```ts
 * getChannelPreference: (call, callback) =>
 *   handleRpc(provider, call, callback, {
 *     handlerKey: IGetChannelPreferenceKey,
 *     mapInput: (req) => ({ contactId: req.contactId }),
 *     mapResponse: (result) => ({
 *       result: d2ResultToProto(result),
 *       data: result.data?.pref ? channelPreferenceToProto(result.data.pref) : undefined,
 *     }),
 *   }),
 * ```
 */
export function handleRpc<TRequest, TResponse, TInput, TOutput>(
  provider: ServiceProvider,
  call: grpc.ServerUnaryCall<TRequest, TResponse>,
  callback: grpc.sendUnaryData<TResponse>,
  options: HandleRpcOptions<TRequest, TResponse, TInput, TOutput>,
): void {
  withTraceContext(call, async () => {
    const scope = createRpcScope(provider, call, options.scopeOptions);
    try {
      const handler = scope.resolve(options.handlerKey);
      const input = options.mapInput(call.request);
      const result = await handler.handleAsync(input);
      const response = options.mapResponse(result);
      callback(null, response);
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      scope.dispose();
    }
  });
}
