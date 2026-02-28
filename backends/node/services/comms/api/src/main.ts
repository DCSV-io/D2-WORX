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
import { DEFAULT_COMMS_JOB_OPTIONS } from "@d2/comms-app";
import {
  defineConfig,
  requiredParsed,
  requiredString,
  optionalString,
  optionalParsed,
  defaultInt,
  envArray,
  optionalSection,
  parsePostgresUrl,
  parseRedisUrl,
} from "@d2/service-defaults/config";
import { createCommsService } from "./composition-root.js";

const logger = createLogger({ serviceName: "comms-service" });

// Aspire injects connection strings in .NET formats (ADO.NET for PG).
// Parser converts to URI format for Node.js clients, passing through URIs unchanged.
const config = defineConfig("comms-service", {
  databaseUrl: requiredParsed(
    parsePostgresUrl,
    "ConnectionStrings__d2-services-comms",
    "ConnectionStrings__d2_services_comms",
  ),
  rabbitMqUrl: requiredString(
    "ConnectionStrings__d2-rabbitmq",
    "ConnectionStrings__d2_rabbitmq",
  ),
  redisUrl: optionalParsed(
    parseRedisUrl,
    "ConnectionStrings__d2-redis",
    "ConnectionStrings__d2_redis",
  ),
  grpcPort: defaultInt(5200, "GRPC_PORT"),
  resendApiKey: optionalString("RESEND_API_KEY"),
  resendFromAddress: optionalString("RESEND_FROM_ADDRESS"),
  twilioAccountSid: optionalString("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: optionalString("TWILIO_AUTH_TOKEN"),
  twilioPhoneNumber: optionalString("TWILIO_PHONE_NUMBER"),
  geoAddress: optionalString("GEO_GRPC_ADDRESS"),
  geoApiKey: optionalString("COMMS_GEO_CLIENT__APIKEY"),
  commsApiKeys: envArray("COMMS_API_KEYS"),
  jobOptions: optionalSection("COMMS_APP", DEFAULT_COMMS_JOB_OPTIONS),
});

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
