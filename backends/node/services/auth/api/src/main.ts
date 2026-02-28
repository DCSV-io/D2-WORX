import { serve } from "@hono/node-server";
import { MessageBus, type IMessagePublisher } from "@d2/messaging";
import { createLogger } from "@d2/logging";
import { parseEnvArray, parsePostgresUrl, parseRedisUrl } from "@d2/service-defaults/config";
import { createApp } from "./composition-root.js";

const logger = createLogger({ serviceName: "auth-service" });

// Aspire injects connection strings in .NET formats (ADO.NET for PG, StackExchange for Redis).
// Parsers convert to URI format for Node.js clients, passing through URIs unchanged.
const config = {
  databaseUrl: parsePostgresUrl(
    process.env["ConnectionStrings__d2-services-auth"] ??
      process.env.ConnectionStrings__d2_services_auth ??
      "",
  ),
  redisUrl: parseRedisUrl(
    process.env["ConnectionStrings__d2-redis"] ?? process.env.ConnectionStrings__d2_redis ?? "",
  ),
  rabbitMqUrl:
    process.env["ConnectionStrings__d2-rabbitmq"] ?? process.env.ConnectionStrings__d2_rabbitmq,
  baseUrl: process.env.AUTH_BASE_URL ?? "http://localhost:5100",
  corsOrigin: process.env.AUTH_CORS_ORIGIN ?? "http://localhost:5173",
  jwtIssuer: process.env.AUTH_JWT_ISSUER ?? "d2-worx",
  jwtAudience: process.env.AUTH_JWT_AUDIENCE ?? "d2-services",
  geoAddress: process.env.GEO_GRPC_ADDRESS,
  geoApiKey: process.env.AUTH_GEO_CLIENT__APIKEY,
  authApiKeys: parseEnvArray("AUTH_API_KEYS"),
  grpcPort: process.env.AUTH_GRPC_PORT ? parseInt(process.env.AUTH_GRPC_PORT, 10) : undefined,
  jobOptions: process.env.AUTH_APP__SIGNINEVENTRETENTIONDAYS
    ? {
        signInEventRetentionDays: parseInt(process.env.AUTH_APP__SIGNINEVENTRETENTIONDAYS, 10),
        invitationRetentionDays: parseInt(process.env.AUTH_APP__INVITATIONRETENTIONDAYS ?? "7", 10),
        lockTtlMs: parseInt(process.env.AUTH_APP__JOBLOCKTTLMS ?? "300000", 10),
      }
    : undefined,
};

if (!config.databaseUrl) {
  logger.error("Missing required env var: ConnectionStrings__d2_services_auth");
  process.exit(1);
}

if (!config.redisUrl) {
  logger.error("Missing required env var: ConnectionStrings__d2_redis");
  process.exit(1);
}

// Optional: RabbitMQ publisher for auth events (verification emails, password resets).
// When not configured, auth-app notification handlers log events but do not publish.
let messageBus: MessageBus | undefined;
let publisher: IMessagePublisher | undefined;
if (config.rabbitMqUrl) {
  messageBus = new MessageBus({ url: config.rabbitMqUrl, connectionName: "auth-service" });
  await messageBus.waitForConnection();
  publisher = messageBus.createPublisher();
  logger.info("RabbitMQ connected");
}

const { app, shutdown } = await createApp(config, publisher, undefined, messageBus);
const port = parseInt(process.env.PORT ?? "5100", 10);

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`Auth service listening on http://localhost:${info.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down...`);
    server.close();
    if (publisher) await publisher.close();
    if (messageBus) await messageBus.close();
    await shutdown();
    process.exit(0);
  });
}
