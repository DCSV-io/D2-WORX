import * as grpc from "@grpc/grpc-js";
import type { ServiceProvider } from "@d2/di";
import type { ILogger } from "@d2/logging";
import { AuthServiceService, AuthJobServiceService } from "@d2/protos";
import { withApiKeyAuth } from "@d2/service-defaults/grpc";
import { createAuthGrpcService } from "../services/auth-grpc-service.js";
import { createAuthJobsGrpcService } from "../services/auth-jobs-grpc-service.js";

export interface GrpcServerOptions {
  provider: ServiceProvider;
  grpcPort: number;
  authApiKeys?: string[];
  logger: ILogger;
}

/**
 * Creates, configures, and binds the gRPC server for AuthService + AuthJobService.
 * Caller is responsible for checking grpcPort availability before calling.
 */
export async function buildGrpcServer(options: GrpcServerOptions): Promise<grpc.Server> {
  const { provider, grpcPort, authApiKeys, logger } = options;

  const server = new grpc.Server();
  const authGrpcService = createAuthGrpcService(provider);
  const jobsGrpcService = createAuthJobsGrpcService(provider);
  const publicRpcs = new Set(["checkHealth"]);

  if (authApiKeys?.length) {
    server.addService(
      AuthServiceService,
      withApiKeyAuth(authGrpcService, {
        validKeys: new Set(authApiKeys),
        logger,
        exempt: publicRpcs,
      }),
    );
    server.addService(
      AuthJobServiceService,
      withApiKeyAuth(jobsGrpcService, { validKeys: new Set(authApiKeys), logger }),
    );
  } else {
    server.addService(AuthServiceService, authGrpcService);
    server.addService(AuthJobServiceService, jobsGrpcService);
  }

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure(), (err) =>
      err ? reject(err) : resolve(),
    );
  });
  logger.info(`Auth gRPC server listening on 0.0.0.0:${grpcPort}`);

  return server;
}
