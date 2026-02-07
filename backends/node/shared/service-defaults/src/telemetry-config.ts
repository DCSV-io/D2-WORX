/**
 * Configuration for OpenTelemetry SDK bootstrap.
 */
export interface TelemetryConfig {
  /** Service name used for resource identification. */
  serviceName: string;
  /** Service version. Default: "0.0.1". */
  serviceVersion?: string;
  /** OTLP HTTP endpoint for metrics (env fallback: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT). */
  metricsEndpoint?: string;
  /** OTLP HTTP endpoint for traces (env fallback: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT). */
  tracesEndpoint?: string;
  /** OTLP HTTP endpoint for logs (env fallback: OTEL_EXPORTER_OTLP_LOGS_ENDPOINT). */
  logsEndpoint?: string;
  /** Deployment environment, e.g. "development", "production". */
  environment?: string;
  /** Extra instrumentations to register alongside the auto-instrumentations. */
  additionalInstrumentations?: unknown[];
}
