/**
 * OTel SDK bootstrap module — load via `--import @d2/service-defaults/register`.
 *
 * This module MUST be loaded before any application code so that ESM loader
 * hooks intercept third-party modules (e.g. Pino, pg, @grpc/grpc-js) and
 * apply instrumentation patches.
 *
 * The explicit `createAddHookMessageChannel()` + `register()` call is required
 * for ESM environments. Without it, `@opentelemetry/auto-instrumentations-node`
 * cannot patch ESM modules — resulting in:
 *   - No log forwarding (Pino → OTLP → Loki)
 *   - No gRPC trace context propagation (disconnected spans)
 *   - No automatic database spans (pg)
 *
 * Configuration is read from standard OTel env vars (set by Aspire's
 * `WithOtelRefs()`):
 *   - OTEL_SERVICE_NAME
 *   - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
 *   - OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
 *   - OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
 */
import { createAddHookMessageChannel } from "import-in-the-middle";
import { register } from "node:module";
import { setupTelemetry } from "./setup-telemetry.js";

// Register ESM loader hooks BEFORE the SDK starts.
// This enables auto-instrumentations to intercept ESM module loading and apply
// runtime patches (Pino log bridging, gRPC context propagation, pg spans, etc.).
const { registerOptions } = createAddHookMessageChannel();
register("import-in-the-middle/hook.mjs", import.meta.url, registerOptions);

const serviceName = process.env.OTEL_SERVICE_NAME ?? "unknown-service";

setupTelemetry({ serviceName });
