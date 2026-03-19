import * as grpc from "@grpc/grpc-js";
import type { FileCallbackServer } from "@d2/protos";
import type { ServiceProvider } from "@d2/di";
import { createRpcScope, withTraceContext } from "@d2/service-defaults/grpc";
import { IHandleFileProcessedKey } from "@d2/auth-app";

/**
 * Creates the FileCallbackServer implementation.
 * Called BY the Files service when file processing completes.
 *
 * Each RPC creates a DI scope for traceId isolation and fresh handler instances.
 */
export function createFileCallbackGrpcService(provider: ServiceProvider): FileCallbackServer {
  return {
    onFileProcessed: (call, callback) => {
      return withTraceContext(call, async () => {
        const scope = createRpcScope(provider, call);
        try {
          const handler = scope.resolve(IHandleFileProcessedKey);
          const result = await handler.handleAsync({
            fileId: call.request.fileId,
            contextKey: call.request.contextKey,
            relatedEntityId: call.request.relatedEntityId,
            status: call.request.status as "ready" | "rejected",
            variants: call.request.variants,
          });

          callback(null, {
            result: {
              success: true,
              statusCode: 200,
              messages: [],
              inputErrors: [],
              errorCode: "",
              traceId: "",
            },
            success: result.success && (result.data?.success ?? false),
          });
        } catch {
          callback({
            code: grpc.status.INTERNAL,
            message: "Internal error",
          });
        } finally {
          scope.dispose();
        }
      });
    },

    canAccess: (call, callback) => {
      return withTraceContext(call, async () => {
        // Auth-owned context keys (user_avatar, org_logo, org_document) use JWT resolution,
        // so CanAccess is never called for them by the Files service. Fail-closed for safety.
        callback(null, {
          result: {
            success: true,
            statusCode: 200,
            messages: [],
            inputErrors: [],
            errorCode: "",
            traceId: "",
          },
          allowed: false,
        });
      });
    },
  };
}
