import * as grpc from "@grpc/grpc-js";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createLogger, type ILogger } from "@d2/logging";
import { ILoggerKey } from "@d2/logging";
import {
  HandlerContext,
  IHandlerContextKey,
  IRequestContextKey,
  createServiceScope,
} from "@d2/handler";
import { ServiceCollection } from "@d2/di";
import * as CacheMemory from "@d2/cache-memory";
import {
  GetContactsByIds,
  IGetContactsByIdsKey,
  createGeoServiceClient,
  DEFAULT_GEO_CLIENT_OPTIONS,
} from "@d2/geo-client";
import Redis from "ioredis";
import { ICachePingKey, PingCache } from "@d2/cache-redis";
import { MessageBus, PingMessageBus, IMessageBusPingKey } from "@d2/messaging";
import { CommsServiceService, CommsJobServiceService } from "@d2/protos";
import {
  addCommsApp,
  IEmailProviderKey,
  ISmsProviderKey,
  ICommsAcquireLockKey,
  ICommsReleaseLockKey,
} from "@d2/comms-app";
import { DEFAULT_COMMS_JOB_OPTIONS, type CommsJobOptions } from "@d2/comms-app";
import { AcquireLock, ReleaseLock } from "@d2/cache-redis";
import {
  addCommsInfra,
  runMigrations,
  createNotificationConsumer,
  declareRetryTopology,
  ResendEmailProvider,
  TwilioSmsProvider,
} from "@d2/comms-infra";
import { createCommsGrpcService } from "./services/comms-grpc-service.js";
import { createCommsJobsGrpcService } from "./services/comms-jobs-grpc-service.js";
import { withApiKeyAuth } from "@d2/service-defaults/grpc";

export interface CommsServiceConfig {
  databaseUrl: string;
  rabbitMqUrl: string;
  grpcPort: number;
  redisUrl?: string;
  resendApiKey?: string;
  resendFromAddress?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  geoAddress?: string;
  geoApiKey?: string;
  commsApiKeys?: string[];
  /** When true, allow startup without API key auth. Default false. */
  allowUnauthenticated?: boolean;
  /** Job options (retention periods, lock TTL). */
  jobOptions?: CommsJobOptions;
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
    throw new Error(
      "GEO_GRPC_ADDRESS and GEO_API_KEY are required — comms service cannot start without Geo",
    );
  }
  const geoClient = createGeoServiceClient(config.geoAddress, config.geoApiKey);
  const geoOptions = { ...DEFAULT_GEO_CLIENT_OPTIONS, apiKey: config.geoApiKey ?? "" };
  const getContactsByIds = new GetContactsByIds(
    contactCacheStore,
    geoClient,
    geoOptions,
    serviceContext,
  );
  services.addInstance(IGetContactsByIdsKey, getContactsByIds);

  // Layer registrations (mirrors services.AddCommsInfra(), services.AddCommsApp())
  addCommsInfra(services, db);
  addCommsApp(services, config.jobOptions ?? DEFAULT_COMMS_JOB_OPTIONS);

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

  // 4. Connect MessageBus early (before provider build) so we can register PingMessageBus
  let messageBus: MessageBus | undefined;
  if (config.rabbitMqUrl) {
    messageBus = new MessageBus({ url: config.rabbitMqUrl, connectionName: "comms-service" });
    await messageBus.waitForConnection();
    logger.info("RabbitMQ connected");

    services.addInstance(IMessageBusPingKey, new PingMessageBus(messageBus, serviceContext));
  } else {
    logger.warn("No RabbitMQ URL configured — event consumption disabled");
  }

  // Job handlers need distributed locks (Redis). Fail fast if jobs are configured without Redis.
  if (config.jobOptions && !config.redisUrl) {
    throw new Error(
      "Job options are configured but no Redis URL provided. Distributed locks require Redis.",
    );
  }

  // Optional Redis connection (for distributed cache health check + distributed locks)
  let redis: Redis | undefined;
  if (config.redisUrl) {
    redis = new Redis(config.redisUrl);
    services.addInstance(ICachePingKey, new PingCache(redis, serviceContext));

    // Distributed lock handlers (singleton — shared Redis connection)
    services.addInstance(ICommsAcquireLockKey, new AcquireLock(redis, serviceContext));
    services.addInstance(ICommsReleaseLockKey, new ReleaseLock(redis, serviceContext));
    logger.info("Redis connected (cache ping + distributed locks registered)");
  }

  // 5. Build ServiceProvider
  const provider = services.build();

  // 6. gRPC server (per-RPC scope via createCommsGrpcService)
  const server = new grpc.Server();
  const grpcService = createCommsGrpcService(provider);
  const jobsGrpcService = createCommsJobsGrpcService(provider);

  if (config.commsApiKeys?.length) {
    const validKeys = new Set(config.commsApiKeys);
    const publicRpcs = new Set(["checkHealth"]);
    server.addService(
      CommsServiceService,
      withApiKeyAuth(grpcService, { validKeys, logger, exempt: publicRpcs }),
    );
    server.addService(
      CommsJobServiceService,
      withApiKeyAuth(jobsGrpcService, { validKeys, logger }),
    );
    logger.info(`Comms gRPC API key authentication enabled (${validKeys.size} key(s))`);
  } else if (config.allowUnauthenticated) {
    server.addService(CommsServiceService, grpcService);
    server.addService(CommsJobServiceService, jobsGrpcService);
    logger.warn(
      "No COMMS_API_KEYS configured — gRPC API key authentication disabled (allowUnauthenticated=true)",
    );
  } else {
    throw new Error(
      "COMMS_API_KEYS not configured. Set COMMS_API_KEYS environment variable or pass allowUnauthenticated=true for local development.",
    );
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

  // 7. RabbitMQ notification consumer (DLX retry topology + consumer)
  if (messageBus) {
    // Declare retry topology (tier queues + requeue exchange) before starting consumer
    await declareRetryTopology(messageBus);
    logger.info("Retry topology declared");

    // Retry publisher for re-publishing failed messages to tier queues
    const retryPublisher = messageBus.createPublisher();

    const consumer = createNotificationConsumer({
      messageBus,
      provider,
      createScope: createServiceScope,
      retryPublisher,
      logger,
    });
    await consumer.ready;
    logger.info("Notification consumer started");
  }

  // 8. Shutdown
  async function shutdown() {
    if (messageBus) await messageBus.close();
    if (redis) redis.disconnect();
    provider.dispose();
    await pool.end();
  }

  return { server, provider, shutdown };
}
