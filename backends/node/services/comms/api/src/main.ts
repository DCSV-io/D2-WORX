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

const config = {
  databaseUrl: process.env.ConnectionStrings__d2_services_comms ?? "",
  rabbitMqUrl: process.env.ConnectionStrings__d2_rabbitmq ?? "",
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
