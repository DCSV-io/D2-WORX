# @d2/service-defaults

One-call OpenTelemetry SDK bootstrap for Node.js services. Mirrors `D2.Shared.ServiceDefaults` in .NET. Layer 0 — depends only on `@opentelemetry/*` packages.

## Files

| File Name                                        | Description                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [setup-telemetry.ts](src/setup-telemetry.ts)     | `setupTelemetry()` function — bootstraps OTel SDK with OTLP exporters for traces/metrics. |
| [telemetry-config.ts](src/telemetry-config.ts)   | `TelemetryConfig` interface for service name, version, and OTLP endpoints.             |
| [index.ts](src/index.ts)                         | Re-exports `setupTelemetry`, `TelemetryConfig`, and key OTel API types.                |

## Usage

```typescript
import { setupTelemetry } from "@d2/service-defaults";

setupTelemetry({
  serviceName: "auth-service",
  serviceVersion: "0.0.1",
  otlpEndpoint: "http://localhost:4318",
});
```

## Re-exports

Re-exports commonly used OTel API types so consumers don't need a direct `@opentelemetry/api` dependency:

- `trace`, `metrics`, `context` — API entry points
- `SpanStatusCode` — For setting span status in handlers
- `Tracer`, `Meter`, `Counter`, `Histogram` — Instrument types

## .NET Equivalent

`D2.Shared.ServiceDefaults` — `AddServiceDefaults()` extension method configuring Serilog, OTel tracing/metrics, health checks, Prometheus exporter.
