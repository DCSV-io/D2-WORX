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
  GetContactsByExtKeys,
  GetContactsByIds,
  IGetContactsByExtKeysKey,
  IGetContactsByIdsKey,
  DEFAULT_GEO_CLIENT_OPTIONS,
  createGeoServiceClient,
  type GeoClientOptions,
} from "@d2/geo-client";
import { GEO_CONTEXT_KEYS } from "@d2/auth-domain";
import { MessageBus } from "@d2/messaging";
import { CommsServiceService } from "@d2/protos";
import {
  addCommsApp,
  ICreateTemplateWrapperRecordKey,
  IFindTemplateByNameAndChannelKey,
  IUpdateTemplateWrapperRecordKey,
} from "@d2/comms-app";
import {
  addCommsInfra,
  runMigrations,
  seedDefaultTemplates,
  createAuthEventConsumer,
  declareRetryTopology,
} from "@d2/comms-infra";
import { createCommsGrpcService } from "./services/comms-grpc-service.js";

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
}

/**
 * Creates a disposable DI scope with a fresh traceId and no auth context.
 * Used for per-RPC, per-message, and startup operations.
 */
function createServiceScope(provider: ServiceProvider): ServiceScope {
  const scope = provider.createScope();
  scope.setInstance<IRequestContext>(IRequestContextKey, {
    traceId: crypto.randomUUID(),
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
    isOrgEmulating: false,
    isUserImpersonating: false,
  });
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
 *   5. Seed default templates (temporary scope)
 *   6. Create gRPC server (per-RPC scope)
 *   7. Create RabbitMQ consumer (per-message scope + DLX retry topology)
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

  // Geo client for recipient resolution (GetContactsByExtKeys)
  const geoOptions: GeoClientOptions = {
    ...DEFAULT_GEO_CLIENT_OPTIONS,
    allowedContextKeys: [GEO_CONTEXT_KEYS.USER, GEO_CONTEXT_KEYS.ORG_CONTACT],
    apiKey: config.geoApiKey ?? "",
  };
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
  const getContactsByExtKeys = new GetContactsByExtKeys(
    contactCacheStore,
    geoClient,
    geoOptions,
    serviceContext,
  );
  const getContactsByIds = new GetContactsByIds(contactCacheStore, geoClient, serviceContext);
  services.addInstance(IGetContactsByExtKeysKey, getContactsByExtKeys);
  services.addInstance(IGetContactsByIdsKey, getContactsByIds);

  // Layer registrations (mirrors services.AddCommsInfra(), services.AddCommsApp())
  addCommsInfra(services, db, {
    resendApiKey: config.resendApiKey,
    resendFromAddress: config.resendFromAddress,
    twilioAccountSid: config.twilioAccountSid,
    twilioAuthToken: config.twilioAuthToken,
    twilioPhoneNumber: config.twilioPhoneNumber,
  });
  addCommsApp(services);

  if (!config.resendApiKey || !config.resendFromAddress) {
    logger.warn("No Resend API key configured — email delivery disabled");
  }
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber) {
    logger.warn("No Twilio credentials configured — SMS delivery disabled");
  }

  // 4. Build ServiceProvider
  const provider = services.build();

  // 5. Seed default templates (idempotent, uses temporary scope)
  {
    const seedScope = createServiceScope(provider);
    try {
      await seedDefaultTemplates(
        {
          create: seedScope.resolve(ICreateTemplateWrapperRecordKey),
          findByNameAndChannel: seedScope.resolve(IFindTemplateByNameAndChannelKey),
          update: seedScope.resolve(IUpdateTemplateWrapperRecordKey),
        },
        seedScope.resolve(IHandlerContextKey),
      );
    } finally {
      seedScope.dispose();
    }
  }

  // 6. gRPC server (per-RPC scope via createCommsGrpcService)
  const server = new grpc.Server();
  server.addService(CommsServiceService, createCommsGrpcService(provider));

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

  // 7. RabbitMQ consumer for auth events (per-message scope + DLX retry topology)
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

    createAuthEventConsumer({
      messageBus,
      provider,
      createScope: createServiceScope,
      retryPublisher,
      logger,
    });
    logger.info("Auth event consumer started");
  } else {
    logger.warn("No RabbitMQ URL configured — event consumption disabled");
  }

  // 8. Shutdown
  async function shutdown() {
    if (messageBus) await messageBus.close();
    provider.dispose();
    await pool.end();
  }

  return { server, shutdown };
}
