import type { CommsJobServiceServer } from "@d2/protos";
import type { ServiceProvider } from "@d2/di";
import { handleJobRpc } from "@d2/service-defaults/grpc";
import { IRunDeletedMessagePurgeKey, IRunDeliveryHistoryPurgeKey } from "@d2/comms-app";

/**
 * Creates the CommsJobServiceServer implementation.
 * Each RPC delegates to {@link handleJobRpc} which manages scope, tracing, and error handling.
 */
export function createCommsJobsGrpcService(provider: ServiceProvider): CommsJobServiceServer {
  return {
    purgeDeletedMessages: (call, callback) =>
      handleJobRpc(provider, call, callback, IRunDeletedMessagePurgeKey, "purge-deleted-messages"),

    purgeDeliveryHistory: (call, callback) =>
      handleJobRpc(provider, call, callback, IRunDeliveryHistoryPurgeKey, "purge-delivery-history"),
  };
}
