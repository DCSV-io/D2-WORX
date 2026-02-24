import { setupTelemetry } from "@d2/service-defaults";

setupTelemetry({ serviceName: "comms-service" });

import { createLogger } from "@d2/logging";
import { createCommsService } from "./composition-root.js";

const logger = createLogger({ serviceName: "comms-service" });

/**
 * Parses indexed environment variables into an array.
 * Reads `${prefix}__0`, `${prefix}__1`, ... until a gap is found.
 * Matches .NET's indexed-array binding convention.
 */
function parseEnvArray(prefix: string): string[] {
  const result: string[] = [];
  for (let i = 0; ; i++) {
    const value = process.env[`${prefix}__${i}`];
    if (value === undefined) break;
    result.push(value);
  }
  return result;
}

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

// Aspire injects connection strings in .NET formats (ADO.NET for PG).
// Parser converts to URI format for Node.js clients, passing through URIs unchanged.
const config = {
  databaseUrl: parsePostgresUrl(process.env["ConnectionStrings__d2-services-comms"] ?? process.env.ConnectionStrings__d2_services_comms ?? ""),
  rabbitMqUrl: process.env["ConnectionStrings__d2-rabbitmq"] ?? process.env.ConnectionStrings__d2_rabbitmq ?? "",
  grpcPort: parseInt(process.env.GRPC_PORT ?? "5200", 10),
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromAddress: process.env.RESEND_FROM_ADDRESS,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
  geoAddress: process.env.GEO_GRPC_ADDRESS,
  geoApiKey: process.env.COMMSGEOCLIENTOPTIONS_APIKEY,
  commsApiKeys: parseEnvArray("COMMS_API_KEYS"),
};

if (!config.databaseUrl) {
  logger.error("Missing required env var: ConnectionStrings__d2_services_comms");
  process.exit(1);
}

const { server, shutdown } = await createCommsService(config);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down...`);
    server.tryShutdown(async () => {
      await shutdown();
      process.exit(0);
    });
  });
}
