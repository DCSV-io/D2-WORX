import { setupTelemetry } from "@d2/service-defaults";

setupTelemetry({ serviceName: "auth-service" });

import { serve } from "@hono/node-server";
import { MessageBus, type IMessagePublisher } from "@d2/messaging";
import { createLogger } from "@d2/logging";
import { createApp } from "./composition-root.js";

const logger = createLogger({ serviceName: "auth-service" });

/**
 * Converts a .NET ADO.NET PostgreSQL connection string to a libpq URI.
 * Passes through strings that are already URIs (standalone / test mode).
 *
 * ADO.NET: `Host=host;Port=port;Username=user;Password=pass;Database=db`
 * URI:     `postgresql://user:pass@host:port/db`
 */
function parsePostgresUrl(connectionString: string): string {
  if (connectionString.startsWith("postgresql://") || connectionString.startsWith("postgres://")) {
    return connectionString;
  }

  const params = new Map<string, string>();
  for (const part of connectionString.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
  }

  const host = params.get("host") ?? "localhost";
  const port = params.get("port") ?? "5432";
  const user = encodeURIComponent(params.get("username") ?? "postgres");
  const password = encodeURIComponent(params.get("password") ?? "");
  const database = params.get("database") ?? "";

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * Converts a .NET StackExchange.Redis connection string to a Redis URI.
 * Passes through strings that are already URIs (standalone / test mode).
 *
 * StackExchange: `host:port,password=pass`
 * URI:           `redis://:pass@host:port`
 */
function parseRedisUrl(connectionString: string): string {
  if (connectionString.startsWith("redis://") || connectionString.startsWith("rediss://")) {
    return connectionString;
  }

  const [hostPort, ...options] = connectionString.split(",");
  const params = new Map<string, string>();
  for (const opt of options) {
    const eq = opt.indexOf("=");
    if (eq === -1) continue;
    params.set(opt.slice(0, eq).trim().toLowerCase(), opt.slice(eq + 1).trim());
  }

  const password = params.get("password");
  const [host, port] = hostPort.includes(":") ? hostPort.split(":") : [hostPort, "6379"];

  return password
    ? `redis://:${encodeURIComponent(password)}@${host}:${port}`
    : `redis://${host}:${port}`;
}

// Aspire injects connection strings in .NET formats (ADO.NET for PG, StackExchange for Redis).
// Parsers convert to URI format for Node.js clients, passing through URIs unchanged.
const config = {
  databaseUrl: parsePostgresUrl(process.env["ConnectionStrings__d2-services-auth"] ?? process.env.ConnectionStrings__d2_services_auth ?? ""),
  redisUrl: parseRedisUrl(process.env["ConnectionStrings__d2-redis"] ?? process.env.ConnectionStrings__d2_redis ?? ""),
  rabbitMqUrl: process.env["ConnectionStrings__d2-rabbitmq"] ?? process.env.ConnectionStrings__d2_rabbitmq,
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
