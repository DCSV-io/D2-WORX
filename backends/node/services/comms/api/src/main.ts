import { setupTelemetry } from "@d2/service-defaults";

setupTelemetry({ serviceName: "comms-service" });

import { createLogger } from "@d2/logging";
import { createCommsService } from "./composition-root.js";

const logger = createLogger({ serviceName: "comms-service" });

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
