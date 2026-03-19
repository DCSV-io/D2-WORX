import * as grpc from "@grpc/grpc-js";
import type { FilesServiceServer } from "@d2/protos";
import type { ServiceProvider } from "@d2/di";
import { createRpcScope, withTraceContext } from "@d2/service-defaults/grpc";
import { ICheckHealthKey } from "@d2/files-app";

/**
 * Creates the FilesServiceServer implementation.
 * Each RPC handler creates a DI scope, resolves its handler(s), and disposes when done.
 */
export function createFilesGrpcService(provider: ServiceProvider): FilesServiceServer {
  return {
    checkHealth: (call, callback) => {
      return withTraceContext(call, async () => {
        const scope = createRpcScope(provider, call);
        try {
          const handler = scope.resolve(ICheckHealthKey);
          const result = await handler.handleAsync({});

          const components: Record<string, { status: string; latencyMs: string; error: string }> =
            {};
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
  };
}
