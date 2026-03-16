export { type TelemetryConfig } from "./telemetry-config.js";
export { setupTelemetry } from "./setup-telemetry.js";
export { getServerSpan, enrichSpan } from "./hono-otel.js";
// Re-export commonly needed OTel API bits so consumers don't need to install @opentelemetry/api
export { trace, metrics, context, SpanStatusCode } from "@opentelemetry/api";
export type { Tracer, Meter, Span } from "@opentelemetry/api";
