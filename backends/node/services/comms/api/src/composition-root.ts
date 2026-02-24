import * as grpc from "@grpc/grpc-js";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createLogger, type ILogger } from "@d2/logging";
import { ILoggerKey } from "@d2/logging";
import { HandlerContext, IHandlerContextKey, IRequestContextKey } from "@d2/handler";
import type { IRequestContext } from "@d2/handler";
import { ServiceCollection, type ServiceProvider, type ServiceScope } from "@d2/di";
import * as CacheMemory from "@d2/cache-memory";
import {
  GetContactsByIds,
  IGetContactsByIdsKey,
  createGeoServiceClient,
} from "@d2/geo-client";
import { MessageBus } from "@d2/messaging";
import { CommsServiceService } from "@d2/protos";
import { addCommsApp, IEmailProviderKey, ISmsProviderKey } from "@d2/comms-app";
import {
  addCommsInfra,
  runMigrations,
  createNotificationConsumer,
  declareRetryTopology,
  ResendEmailProvider,
  TwilioSmsProvider,
} from "@d2/comms-infra";
import { createCommsGrpcService } from "./services/comms-grpc-service.js";
import { withApiKeyAuth } from "./interceptors/api-key-interceptor.js";

export interface CommsServiceConfig {
  databaseUrl: string;
  rabbitMqUrl: string;
  grpcPort: number;
  resendApiKey?: string;
  resendFromAddress?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  geoAddress?: string;
  geoApiKey?: string;
  commsApiKeys?: string[];
}

/**
 * Creates a disposable DI scope with a fresh traceId and no auth context.
 * Used for per-RPC, per-message, and startup operations.
 */
function createServiceScope(provider: ServiceProvider): ServiceScope {
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
 * Creates and wires the complete comms service application.
 *
 * This is the composition root (mirrors .NET Program.cs):
 *   1. Create singletons: pg.Pool, logger
 *   2. Run Drizzle migrations
 *   3. Register all services in ServiceCollection
 *   4. Build ServiceProvider
 *   5. Create gRPC server (per-RPC scope)
 *   6. Create RabbitMQ consumer (per-message scope + DLX retry topology)
 */
export async function createCommsService(config: CommsServiceConfig) {
  // 1. Singletons: pg.Pool, logger
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const logger: ILogger = createLogger({ serviceName: "comms-service" });

  // Service-level HandlerContext for pre-scope operations (geo-client cache)
  const serviceContext = new HandlerContext(
    {
      isAuthenticated: false,
      isAgentStaff: false,
      isAgentAdmin: false,
      isTargetingStaff: false,
      isTargetingAdmin: false,
      isOrgEmulating: false,
      isUserImpersonating: false,
    },
    logger,
  );

  // 2. Run Drizzle migrations
  await runMigrations(pool);
  const db = drizzle(pool);

  // 3. Build ServiceCollection (mirrors .NET Program.cs)
  const services = new ServiceCollection();

  // Logger — singleton (pre-built instance)
  services.addInstance(ILoggerKey, logger);

  // IHandlerContext — scoped (new per request/message, built from IRequestContext + logger)
  services.addScoped(
    IHandlerContextKey,
    (sp) => new HandlerContext(sp.resolve(IRequestContextKey), sp.resolve(ILoggerKey)),
  );

  // Geo client for recipient resolution (GetContactsByIds)
  const contactCacheStore = new CacheMemory.MemoryCacheStore();
  if (!config.geoAddress || !config.geoApiKey) {
    logger.warn(
      "Geo gRPC client not configured (missing GEO_GRPC_ADDRESS or API key) — recipient resolution will fail",
    );
  }
  const geoClient =
    config.geoAddress && config.geoApiKey
      ? createGeoServiceClient(config.geoAddress, config.geoApiKey)
      : (undefined as never);
  const getContactsByIds = new GetContactsByIds(contactCacheStore, geoClient, serviceContext);
  services.addInstance(IGetContactsByIdsKey, getContactsByIds);

  // Layer registrations (mirrors services.AddCommsInfra(), services.AddCommsApp())
  addCommsInfra(services, db);
  addCommsApp(services);

  // Delivery providers — singleton instances with service-level context.
  // Created here (not in addCommsInfra) because they hold API client connections
  // and must use service-level HandlerContext, not a scoped one.
  if (config.resendApiKey && config.resendFromAddress) {
    services.addInstance(
      IEmailProviderKey,
      new ResendEmailProvider(config.resendApiKey, config.resendFromAddress, serviceContext),
    );
  } else {
    logger.warn("No Resend API key configured — email delivery disabled");
  }
  if (config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber) {
    services.addInstance(
      ISmsProviderKey,
      new TwilioSmsProvider(
        config.twilioAccountSid,
        config.twilioAuthToken,
        config.twilioPhoneNumber,
        serviceContext,
      ),
    );
  } else {
    logger.warn("No Twilio credentials configured — SMS delivery disabled");
  }

  // 4. Build ServiceProvider
  const provider = services.build();

  // 5. gRPC server (per-RPC scope via createCommsGrpcService)
  const server = new grpc.Server();
  const grpcService = createCommsGrpcService(provider);

  if (config.commsApiKeys?.length) {
    const validKeys = new Set(config.commsApiKeys);
    server.addService(CommsServiceService, withApiKeyAuth(grpcService, validKeys, logger));
    logger.info(`Comms gRPC API key authentication enabled (${validKeys.size} key(s))`);
  } else {
    server.addService(CommsServiceService, grpcService);
    logger.warn("No COMMS_API_KEYS configured — gRPC API key authentication disabled");
  }

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        logger.info(`Comms gRPC server listening on 0.0.0.0:${config.grpcPort}`);
        resolve();
      },
    );
  });

  // 6. RabbitMQ notification consumer (per-message scope + DLX retry topology)
  let messageBus: MessageBus | undefined;
  if (config.rabbitMqUrl) {
    messageBus = new MessageBus({ url: config.rabbitMqUrl, connectionName: "comms-service" });
    await messageBus.waitForConnection();
    logger.info("RabbitMQ connected");

    // Declare retry topology (tier queues + requeue exchange) before starting consumer
    await declareRetryTopology(messageBus);
    logger.info("Retry topology declared");

    // Retry publisher for re-publishing failed messages to tier queues
    const retryPublisher = messageBus.createPublisher();

    createNotificationConsumer({
      messageBus,
      provider,
      createScope: createServiceScope,
      retryPublisher,
      logger,
    });
    logger.info("Notification consumer started");
  } else {
    logger.warn("No RabbitMQ URL configured — event consumption disabled");
  }

  // 7. Shutdown
  async function shutdown() {
    if (messageBus) await messageBus.close();
    provider.dispose();
    await pool.end();
  }

  return { server, shutdown };
}
