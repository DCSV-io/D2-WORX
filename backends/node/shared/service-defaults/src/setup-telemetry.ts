import { IncomingMessage } from "node:http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { SimpleLogRecordProcessor, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import {
  CompositePropagator,
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
} from "@opentelemetry/core";
import type { Span } from "@opentelemetry/api";
import type { TelemetryConfig } from "./telemetry-config.js";

/**
 * Property key used to store the OTel HTTP server span on Node.js IncomingMessage.
 *
 * @hono/node-server doesn't propagate the OTel async context into Hono's
 * middleware chain, so `trace.getActiveSpan()` returns null there. As a
 * workaround, the HTTP instrumentation's `requestHook` stashes the span on the
 * raw request object, and Hono middleware retrieves it via `c.env.incoming`.
 *
 * @see getServerSpan in hono-otel.ts
 */
export const OTEL_SPAN_KEY = Symbol.for("d2.otel.incomingSpan");

/** Augmented IncomingMessage with optional stored OTel span. */
export interface OTelIncomingMessage extends IncomingMessage {
  [OTEL_SPAN_KEY]?: Span | undefined;
}

/**
 * One-call OpenTelemetry SDK bootstrap — mirrors .NET's `builder.AddServiceDefaults()`.
 *
 * Call at app entry point:
 * ```ts
 * setupTelemetry({ serviceName: "auth" });
 * ```
 *
 * Endpoints can be set via the config object OR standard OTel env vars
 * (`OTEL_EXPORTER_OTLP_*`). Config object takes precedence.
 *
 * When `@opentelemetry/auto-instrumentations-node` is active, it includes
 * `@opentelemetry/instrumentation-pino`, so any Pino logger created by
 * `@d2/logging` automatically gets trace context injection + log forwarding.
 */
export function setupTelemetry(config: TelemetryConfig): void {
  const serviceVersion = config.serviceVersion ?? "0.0.1";

  // Build resource attributes
  const resourceAttributes: Record<string, string> = {
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  };
  if (config.environment) {
    resourceAttributes["deployment.environment.name"] = config.environment;
  }

  const resource = resourceFromAttributes(resourceAttributes);

  // Resolve endpoints (config takes precedence over env vars)
  const tracesEndpoint = config.tracesEndpoint ?? process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const metricsEndpoint = config.metricsEndpoint ?? process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
  const logsEndpoint = config.logsEndpoint ?? process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;

  // Trace exporter
  const traceExporter = tracesEndpoint ? new OTLPTraceExporter({ url: tracesEndpoint }) : undefined;

  // Metrics reader
  const metricReaders = metricsEndpoint
    ? [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: metricsEndpoint }),
        }),
      ]
    : [];

  // Log processor
  const logRecordProcessors = logsEndpoint
    ? [
        config.environment === "development"
          ? new SimpleLogRecordProcessor(new OTLPLogExporter({ url: logsEndpoint }))
          : new BatchLogRecordProcessor(new OTLPLogExporter({ url: logsEndpoint })),
      ]
    : [];

  // Instrumentations: auto-instrumentations always included, plus any extras.
  // The HTTP requestHook stores the server span on IncomingMessage so that
  // frameworks that break async context (e.g. @hono/node-server) can still
  // access the span via the raw request object.
  const autoInstrumentations = getNodeAutoInstrumentations({
    "@opentelemetry/instrumentation-http": {
      requestHook: (span: Span, request: unknown) => {
        if (request instanceof IncomingMessage) {
          (request as OTelIncomingMessage)[OTEL_SPAN_KEY] = span;
        }
      },
    },
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReaders,
    logRecordProcessors,
    // Propagate both W3C trace context (traceparent/tracestate) AND baggage
    // headers on outgoing HTTP/gRPC calls. The default SDK only registers
    // W3CTraceContextPropagator — without the baggage propagator, any
    // baggage set via propagation.setBaggage() stays in-memory only.
    textMapPropagator: new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
    instrumentations: [
      ...autoInstrumentations,
      ...(config.additionalInstrumentations ?? []),
    ] as NodeSDKConfiguration["instrumentations"],
    serviceName: config.serviceName,
  });

  sdk.start();

  // Graceful shutdown
  const shutdown = async () => {
    await sdk.shutdown();
  };

  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
}
