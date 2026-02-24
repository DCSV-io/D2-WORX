import * as grpc from "@grpc/grpc-js";
import { context, propagation, trace } from "@opentelemetry/api";
import type { CommsServiceServer } from "@d2/protos";
import type { ServiceProvider } from "@d2/di";
import { HandlerContext, IHandlerContextKey, IRequestContextKey } from "@d2/handler";
import type { IRequestContext } from "@d2/handler";
import { ILoggerKey } from "@d2/logging";
import type { ServiceScope } from "@d2/di";
import {
  ICheckHealthKey,
  IGetChannelPreferenceKey,
  ISetChannelPreferenceKey,
  IFindDeliveryRequestByIdKey,
  IFindDeliveryAttemptsByRequestIdKey,
} from "@d2/comms-app";
import { D2Result } from "@d2/result";
import { d2ResultToProto } from "@d2/result-extensions";
import { channelPreferenceToProto } from "../mappers/channel-preference-mapper.js";
import { deliveryRequestToProto, deliveryAttemptToProto } from "../mappers/delivery-mapper.js";

/**
 * Extracts the W3C trace context (traceparent) from incoming gRPC metadata.
 * Returns an OTel Context with the extracted parent span, enabling child spans
 * created within this context to be properly linked in the distributed trace.
 *
 * This is needed because `@opentelemetry/instrumentation-grpc` auto-instrumentation
 * does not reliably patch `@grpc/grpc-js` server-side context extraction in ESM.
 */
function extractGrpcTraceContext(call: grpc.ServerUnaryCall<unknown, unknown>) {
  const carrier: Record<string, string> = {};
  const metadata = call.metadata.getMap();
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string") {
      carrier[key] = value;
    }
  }
  return propagation.extract(context.active(), carrier);
}

/**
 * Creates a disposable DI scope with trace context from the incoming gRPC call.
 * Uses the OTel traceId from the propagated context when available, falling back
 * to a fresh UUID for non-instrumented callers.
 */
function createRpcScope(
  provider: ServiceProvider,
  call: grpc.ServerUnaryCall<unknown, unknown>,
): ServiceScope {
  const scope = provider.createScope();

  // Use the OTel traceId from the incoming context when available.
  const spanCtx = trace.getSpanContext(extractGrpcTraceContext(call));
  const traceId = spanCtx?.traceId ?? crypto.randomUUID();

  const requestContext: IRequestContext = {
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

/**
 * Runs an async RPC handler within the extracted gRPC trace context.
 * This ensures all child spans (BaseHandler, pg, dns, etc.) are properly
 * parented under the caller's trace.
 */
function withTraceContext<TReq, TRes>(
  call: grpc.ServerUnaryCall<TReq, TRes>,
  fn: () => Promise<void>,
): void {
  const parentCtx = extractGrpcTraceContext(call as grpc.ServerUnaryCall<unknown, unknown>);
  void context.with(parentCtx, fn);
}

/**
 * Creates the CommsServiceServer implementation.
 * Each RPC handler creates a DI scope, resolves its handler(s), and disposes when done.
 * This ensures per-RPC traceId isolation and fresh handler instances.
 */
export function createCommsGrpcService(provider: ServiceProvider): CommsServiceServer {
  return {
    // ---- Health Check ----

    checkHealth: (call, callback) => {
      withTraceContext(call, async () => {
        const scope = createRpcScope(provider, call);
        try {
          const handler = scope.resolve(ICheckHealthKey);
          const result = await handler.handleAsync({});

          const components: Record<string, { status: string; latencyMs: string; error: string }> = {};
          if (result.data?.components) {
            for (const [key, comp] of Object.entries(result.data.components)) {
              components[key] = {
                status: comp.status,
                latencyMs: String(comp.latencyMs ?? 0),
                error: comp.error ?? "",
              };
            }
          }

          callback(null, {
            status: result.data?.status ?? "unhealthy",
            timestamp: new Date().toISOString(),
            components,
          });
        } catch (err) {
          callback({
            code: grpc.status.INTERNAL,
            message: err instanceof Error ? err.message : "Unknown error",
          });
        } finally {
          scope.dispose();
        }
      });
    },

    // ---- Phase 1: Delivery Engine ----

    getChannelPreference: (call, callback) => {
      withTraceContext(call, async () => {
        const scope = createRpcScope(provider, call);
        try {
          const { contactId } = call.request;
          const handler = scope.resolve(IGetChannelPreferenceKey);
          const result = await handler.handleAsync({
            contactId,
          });

          if (!result.success || !result.data?.pref) {
            callback(null, {
              result: d2ResultToProto(
                result.data?.pref ? result : D2Result.notFound({ traceId: result.traceId }),
              ),
              data: undefined,
            });
            return;
          }

          callback(null, {
            result: d2ResultToProto(result),
            data: channelPreferenceToProto(result.data.pref),
          });
        } catch (err) {
          callback({
            code: grpc.status.INTERNAL,
            message: err instanceof Error ? err.message : "Unknown error",
          });
        } finally {
          scope.dispose();
        }
      });
    },

    setChannelPreference: (call, callback) => {
      withTraceContext(call, async () => {
        const scope = createRpcScope(provider, call);
        try {
          const req = call.request;
          const handler = scope.resolve(ISetChannelPreferenceKey);
          const result = await handler.handleAsync({
            contactId: req.contactId,
            emailEnabled: req.emailEnabled,
            smsEnabled: req.smsEnabled,
          });

          if (!result.success || !result.data) {
            callback(null, {
              result: d2ResultToProto(result),
              data: undefined,
            });
            return;
          }

          callback(null, {
            result: d2ResultToProto(result),
            data: channelPreferenceToProto(result.data.pref),
          });
        } catch (err) {
          callback({
            code: grpc.status.INTERNAL,
            message: err instanceof Error ? err.message : "Unknown error",
          });
        } finally {
          scope.dispose();
        }
      });
    },

    // Template RPCs — no longer implemented (templates removed from architecture)
    getTemplate: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    upsertTemplate: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },

    getDeliveryStatus: (call, callback) => {
      withTraceContext(call, async () => {
        const scope = createRpcScope(provider, call);
        try {
          const { deliveryRequestId } = call.request;

          const findRequestById = scope.resolve(IFindDeliveryRequestByIdKey);
          const reqResult = await findRequestById.handleAsync({
            id: deliveryRequestId,
          });

          if (!reqResult.success || !reqResult.data?.request) {
            callback(null, {
              result: d2ResultToProto(D2Result.notFound({ traceId: reqResult.traceId })),
              request: undefined,
              attempts: [],
            });
            return;
          }

          const findAttemptsByRequestId = scope.resolve(IFindDeliveryAttemptsByRequestIdKey);
          const attemptsResult = await findAttemptsByRequestId.handleAsync({
            requestId: deliveryRequestId,
          });

          const attempts =
            attemptsResult.success && attemptsResult.data
              ? attemptsResult.data.attempts.map(deliveryAttemptToProto)
              : [];

          callback(null, {
            result: d2ResultToProto(D2Result.ok()),
            request: deliveryRequestToProto(reqResult.data.request),
            attempts,
          });
        } catch (err) {
          callback({
            code: grpc.status.INTERNAL,
            message: err instanceof Error ? err.message : "Unknown error",
          });
        } finally {
          scope.dispose();
        }
      });
    },

    // ---- Phase 2: In-App Notifications (stubs) ----
    getNotifications: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    markNotificationsRead: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },

    // ---- Phase 3: Conversational Messaging (stubs) ----
    createThread: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    getThread: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    getThreads: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    postMessage: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    editMessage: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    deleteMessage: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    getThreadMessages: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    addReaction: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    removeReaction: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    addParticipant: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    removeParticipant: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
  };
}
