// NOTE: OpenTelemetry is bootstrapped via the `--import @d2/service-defaults/register`
// Node.js loader flag in package.json scripts (dev + start). The register module:
//   1. Calls `createAddHookMessageChannel()` + `register()` to install ESM loader hooks
//      BEFORE any application code loads, enabling auto-instrumentation of Pino, pg,
//      @grpc/grpc-js, etc.
//   2. Calls `setupTelemetry({ serviceName })` using OTEL_SERVICE_NAME from env vars
//      (set by Aspire's `WithOtelRefs()`).
//
// This means OTel is fully active before this file even executes. There is no need
// for an explicit `setupTelemetry()` call here. The `--import` approach is required
// for ESM environments (vs. the older `--require` for CJS) so that instrumentation
// patches are applied before module imports are resolved.

import { createLogger } from "@d2/logging";
import { parseEnvArray, parsePostgresUrl, parseRedisUrl } from "@d2/service-defaults/config";
import { createCommsService } from "./composition-root.js";

function parseIntStrict(value: string, name: string): number {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric env var ${name}="${value}" — must be a positive integer`);
  }
  return parsed;
}

const logger = createLogger({ serviceName: "comms-service" });

// Aspire injects connection strings in .NET formats (ADO.NET for PG).
// Parser converts to URI format for Node.js clients, passing through URIs unchanged.
const config = {
  databaseUrl: parsePostgresUrl(
    process.env["ConnectionStrings__d2-services-comms"] ??
      process.env.ConnectionStrings__d2_services_comms ??
      "",
  ),
  rabbitMqUrl:
    process.env["ConnectionStrings__d2-rabbitmq"] ??
    process.env.ConnectionStrings__d2_rabbitmq ??
    "",
  redisUrl: parseRedisUrl(
    process.env["ConnectionStrings__d2-redis"] ?? process.env.ConnectionStrings__d2_redis ?? "",
  ) || undefined,
  grpcPort: parseInt(process.env.GRPC_PORT ?? "5200", 10),
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromAddress: process.env.RESEND_FROM_ADDRESS,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
  geoAddress: process.env.GEO_GRPC_ADDRESS,
  geoApiKey: process.env.COMMS_GEO_CLIENT__APIKEY,
  commsApiKeys: parseEnvArray("COMMS_API_KEYS"),
  jobOptions: process.env.COMMS_APP__DELETEDMESSAGERETENTIONDAYS
    ? {
        deletedMessageRetentionDays: parseIntStrict(
          process.env.COMMS_APP__DELETEDMESSAGERETENTIONDAYS!,
          "COMMS_APP__DELETEDMESSAGERETENTIONDAYS",
        ),
        deliveryHistoryRetentionDays: parseIntStrict(
          process.env.COMMS_APP__DELIVERYHISTORYRETENTIONDAYS ?? "365",
          "COMMS_APP__DELIVERYHISTORYRETENTIONDAYS",
        ),
        lockTtlMs: parseIntStrict(
          process.env.COMMS_APP__JOBLOCKTTLMS ?? "300000",
          "COMMS_APP__JOBLOCKTTLMS",
        ),
      }
    : undefined,
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
