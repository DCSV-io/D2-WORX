import * as grpc from "@grpc/grpc-js";
import type { CommsServiceServer } from "@d2/protos";
import type { ServiceProvider } from "@d2/di";
import { HandlerContext, IHandlerContextKey, IRequestContextKey } from "@d2/handler";
import type { IRequestContext } from "@d2/handler";
import { ILoggerKey } from "@d2/logging";
import type { ServiceScope } from "@d2/di";
import {
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
 * Creates a disposable DI scope with a fresh traceId and no auth context.
 * Used for per-RPC operations in the gRPC service.
 */
function createRpcScope(provider: ServiceProvider): ServiceScope {
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
  scope.setInstance(
    IHandlerContextKey,
    new HandlerContext(requestContext, provider.resolve(ILoggerKey)),
  );
  return scope;
}

/**
 * Creates the CommsServiceServer implementation.
 * Each RPC handler creates a DI scope, resolves its handler(s), and disposes when done.
 * This ensures per-RPC traceId isolation and fresh handler instances.
 */
export function createCommsGrpcService(provider: ServiceProvider): CommsServiceServer {
  return {
    // ---- Phase 1: Delivery Engine ----

    getChannelPreference: async (call, callback) => {
      const scope = createRpcScope(provider);
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
    },

    setChannelPreference: async (call, callback) => {
      const scope = createRpcScope(provider);
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
    },

    // Template RPCs — no longer implemented (templates removed from architecture)
    getTemplate: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },
    upsertTemplate: (_call, cb) => {
      cb({ code: grpc.status.UNIMPLEMENTED, message: "Not implemented" });
    },

    getDeliveryStatus: async (call, callback) => {
      const scope = createRpcScope(provider);
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
