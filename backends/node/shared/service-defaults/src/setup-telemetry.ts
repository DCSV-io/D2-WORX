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
import type { TelemetryConfig } from "./telemetry-config.js";

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

  // Instrumentations: auto-instrumentations always included, plus any extras
  const autoInstrumentations = getNodeAutoInstrumentations();

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReaders,
    logRecordProcessors,
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
