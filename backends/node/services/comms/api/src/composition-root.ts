import * as grpc from "@grpc/grpc-js";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createLogger, type ILogger } from "@d2/logging";
import { HandlerContext } from "@d2/handler";
import * as CacheMemory from "@d2/cache-memory";
import {
  GetContactsByExtKeys,
  DEFAULT_GEO_CLIENT_OPTIONS,
  createGeoServiceClient,
  type GeoClientOptions,
} from "@d2/geo-client";
import { MessageBus } from "@d2/messaging";
import { CommsServiceService } from "@d2/protos";
import type { ChannelPreference, TemplateWrapper } from "@d2/comms-domain";
import { createDeliveryHandlers, createDeliverySubHandlers } from "@d2/comms-app";
import {
  createMessageRepoHandlers,
  createDeliveryRequestRepoHandlers,
  createDeliveryAttemptRepoHandlers,
  createChannelPreferenceRepoHandlers,
  createTemplateWrapperRepoHandlers,
  runMigrations,
  ResendEmailProvider,
  TwilioSmsProvider,
  createAuthEventConsumer,
  seedDefaultTemplates,
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

export async function createCommsService(config: CommsServiceConfig) {
  // 1. Singletons: pg.Pool, logger
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const logger: ILogger = createLogger({ serviceName: "comms-service" });

  const handlerContext = new HandlerContext(
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

  // 3. Repository handler factories
  const repos = {
    message: createMessageRepoHandlers(db, handlerContext),
    request: createDeliveryRequestRepoHandlers(db, handlerContext),
    attempt: createDeliveryAttemptRepoHandlers(db, handlerContext),
    channelPref: createChannelPreferenceRepoHandlers(db, handlerContext),
    template: createTemplateWrapperRepoHandlers(db, handlerContext),
  };

  // 4. Providers
  const emailProvider =
    config.resendApiKey && config.resendFromAddress
      ? new ResendEmailProvider(config.resendApiKey, config.resendFromAddress, handlerContext)
      : undefined;

  const smsProvider =
    config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber
      ? new TwilioSmsProvider(
          config.twilioAccountSid,
          config.twilioAuthToken,
          config.twilioPhoneNumber,
          handlerContext,
        )
      : undefined;

  if (!emailProvider) {
    logger.warn("No Resend API key configured — email delivery disabled");
  }
  if (!smsProvider) {
    logger.warn("No Twilio credentials configured — SMS delivery disabled");
  }

  // 5. Geo client for recipient resolution (GetContactsByExtKeys)
  const geoOptions: GeoClientOptions = {
    ...DEFAULT_GEO_CLIENT_OPTIONS,
    allowedContextKeys: ["user", "org_contact"],
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
    handlerContext,
  );

  // 6. In-memory caches for channel prefs and templates
  const prefCacheStore = new CacheMemory.MemoryCacheStore();
  const tplCacheStore = new CacheMemory.MemoryCacheStore();

  const cache = {
    channelPref: {
      get: new CacheMemory.Get<ChannelPreference>(prefCacheStore, handlerContext),
      set: new CacheMemory.Set<ChannelPreference>(prefCacheStore, handlerContext),
    },
    template: {
      get: new CacheMemory.Get<TemplateWrapper>(tplCacheStore, handlerContext),
      set: new CacheMemory.Set<TemplateWrapper>(tplCacheStore, handlerContext),
    },
  };

  // 7. Delivery engine handlers
  const deliveryHandlers = createDeliveryHandlers(
    repos,
    { email: emailProvider!, sms: smsProvider },
    getContactsByExtKeys,
    handlerContext,
    cache,
  );

  // 8. Seed default templates (idempotent)
  await seedDefaultTemplates(repos.template, handlerContext);

  // 9. gRPC server
  const server = new grpc.Server();
  server.addService(
    CommsServiceService,
    createCommsGrpcService(deliveryHandlers, {
      request: repos.request,
      attempt: repos.attempt,
    }),
  );

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

  // 10. RabbitMQ consumer for auth events
  let messageBus: MessageBus | undefined;
  if (config.rabbitMqUrl) {
    messageBus = new MessageBus({ url: config.rabbitMqUrl, connectionName: "comms-service" });
    await messageBus.waitForConnection();
    logger.info("RabbitMQ connected");

    const subHandlers = createDeliverySubHandlers(deliveryHandlers.deliver, handlerContext);
    await createAuthEventConsumer(messageBus, subHandlers);
    logger.info("Auth event consumer started");
  } else {
    logger.warn("No RabbitMQ URL configured — event consumption disabled");
  }

  // 11. Shutdown
  async function shutdown() {
    if (messageBus) await messageBus.close();
    await pool.end();
  }

  return { server, shutdown };
}
