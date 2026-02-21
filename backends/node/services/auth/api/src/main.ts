import { setupTelemetry } from "@d2/service-defaults";

setupTelemetry({ serviceName: "auth-service" });

import { serve } from "@hono/node-server";
import { MessageBus, type IMessagePublisher } from "@d2/messaging";
import { createLogger } from "@d2/logging";
import { createApp } from "./composition-root.js";

const logger = createLogger({ serviceName: "auth-service" });

const config = {
  databaseUrl: process.env.ConnectionStrings__d2_services_auth ?? "",
  redisUrl: process.env.ConnectionStrings__d2_redis ?? "",
  rabbitMqUrl: process.env.ConnectionStrings__d2_rabbitmq,
  baseUrl: process.env.AUTH_BASE_URL ?? "http://localhost:3100",
  corsOrigin: process.env.AUTH_CORS_ORIGIN ?? "http://localhost:5173",
  jwtIssuer: process.env.AUTH_JWT_ISSUER ?? "d2-worx",
  jwtAudience: process.env.AUTH_JWT_AUDIENCE ?? "d2-services",
  geoAddress: process.env.GEO_GRPC_ADDRESS,
  geoApiKey: process.env.AUTHGEOCLIENTOPTIONS_APIKEY,
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

const { app, shutdown } = await createApp(config, publisher);
const port = parseInt(process.env.PORT ?? "3100", 10);

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
