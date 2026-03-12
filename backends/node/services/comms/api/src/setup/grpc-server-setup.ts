import * as grpc from "@grpc/grpc-js";
import type { ServiceProvider } from "@d2/di";
import type { ILogger } from "@d2/logging";
import type Redis from "ioredis";
import { CommsServiceService, CommsJobServiceService } from "@d2/protos";
import { withApiKeyAuth } from "@d2/service-defaults/grpc";
import { createCommsGrpcService } from "../services/comms-grpc-service.js";
import { createCommsJobsGrpcService } from "../services/comms-jobs-grpc-service.js";

export interface CommsGrpcServerOptions {
  provider: ServiceProvider;
  grpcPort: number;
  commsApiKeys?: string[];
  allowUnauthenticated?: boolean;
  redis?: Redis;
  logger: ILogger;
}

/**
 * Creates, configures, and binds the gRPC server for CommsService + CommsJobService.
 */
export async function buildGrpcServer(options: CommsGrpcServerOptions): Promise<grpc.Server> {
  const { provider, grpcPort, commsApiKeys, allowUnauthenticated, redis, logger } = options;

  const server = new grpc.Server();
  const grpcService = createCommsGrpcService(provider);

  // Job gRPC service requires Redis (distributed locks). Only register when available.
  const jobsGrpcService = redis ? createCommsJobsGrpcService(provider) : undefined;

  if (commsApiKeys?.length) {
    const validKeys = new Set(commsApiKeys);
    const publicRpcs = new Set(["checkHealth"]);
    server.addService(
      CommsServiceService,
      withApiKeyAuth(grpcService, { validKeys, logger, exempt: publicRpcs }),
    );
    if (jobsGrpcService) {
      server.addService(
        CommsJobServiceService,
        withApiKeyAuth(jobsGrpcService, { validKeys, logger }),
      );
    }
    logger.info(`Comms gRPC API key authentication enabled (${validKeys.size} key(s))`);
  } else if (allowUnauthenticated) {
    server.addService(CommsServiceService, grpcService);
    if (jobsGrpcService) {
      server.addService(CommsJobServiceService, jobsGrpcService);
    }
    logger.warn(
      "No COMMS_API_KEYS configured — gRPC API key authentication disabled (allowUnauthenticated=true)",
    );
  } else {
    throw new Error(
      "COMMS_API_KEYS not configured. Set COMMS_API_KEYS environment variable or pass allowUnauthenticated=true for local development.",
    );
  }

  if (!jobsGrpcService) {
    logger.warn("No Redis configured — job gRPC service disabled (distributed locks unavailable)");
  }

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) {
        reject(err);
        return;
      }
      logger.info(`Comms gRPC server listening on 0.0.0.0:${grpcPort}`);
      resolve();
    });
  });

  return server;
}
