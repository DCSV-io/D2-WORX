# @d2/service-defaults

One-call OpenTelemetry SDK bootstrap for Node.js services. Mirrors `D2.Shared.ServiceDefaults` in .NET. Layer 0 — depends only on `@opentelemetry/*` packages.

## Files

| File Name                                                              | Description                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [setup-telemetry.ts](src/setup-telemetry.ts)                           | `setupTelemetry()` function — bootstraps OTel SDK with OTLP exporters for traces/metrics/logs.   |
| [telemetry-config.ts](src/telemetry-config.ts)                         | `TelemetryConfig` interface for service name, version, and per-signal OTLP endpoints.            |
| [register.ts](src/register.ts)                                         | ESM loader bootstrap — `--import @d2/service-defaults/register` for pre-app OTel initialization. |
| [grpc/create-rpc-scope.ts](src/grpc/create-rpc-scope.ts)               | `createRpcScope()` — creates a per-RPC DI scope with traceId + HandlerContext.                   |
| [grpc/extract-trace-context.ts](src/grpc/extract-trace-context.ts)     | `extractGrpcTraceContext()` — extracts OTel trace context from incoming gRPC metadata.           |
| [grpc/with-trace-context.ts](src/grpc/with-trace-context.ts)           | `withTraceContext()` — propagates OTel trace context to outgoing gRPC calls.                     |
| [grpc/with-api-key-auth.ts](src/grpc/with-api-key-auth.ts)             | `withApiKeyAuth()` — adds `x-api-key` metadata to outgoing gRPC client calls.                    |
| [grpc/is-transient-grpc-error.ts](src/grpc/is-transient-grpc-error.ts) | `isTransientGrpcError()` — classifies gRPC status codes for retry decisions.                     |
| [index.ts](src/index.ts)                                               | Re-exports `setupTelemetry`, `TelemetryConfig`, and key OTel API types.                          |

## Usage

```typescript
import { setupTelemetry } from "@d2/service-defaults";

setupTelemetry({
  serviceName: "auth-service",
  serviceVersion: "0.0.1",
  tracesEndpoint: "http://localhost:4318/v1/traces",
  metricsEndpoint: "http://localhost:4318/v1/metrics",
  logsEndpoint: "http://localhost:4318/v1/logs",
});
```

## Re-exports

Re-exports commonly used OTel API types so consumers don't need a direct `@opentelemetry/api` dependency:

- `trace`, `metrics`, `context` — API entry points
- `SpanStatusCode` — For setting span status in handlers
- `Tracer`, `Meter`, `Span` — Instrument types (type-only exports)

## gRPC Utilities

Shared helpers for gRPC services and clients, importable via `@d2/service-defaults/grpc`:

```typescript
import {
  createRpcScope,
  extractGrpcTraceContext,
  withTraceContext,
  withApiKeyAuth,
  isTransientGrpcError,
} from "@d2/service-defaults/grpc";
```

- **`createRpcScope(provider, metadata)`** — Creates a per-RPC DI scope with auto-generated traceId and HandlerContext. Used in gRPC service implementations.
- **`extractGrpcTraceContext(metadata)`** — Extracts OTel trace context from incoming gRPC metadata for context propagation.
- **`withTraceContext(metadata)`** — Injects current OTel trace context into outgoing gRPC metadata.
- **`withApiKeyAuth(apiKey)`** — Returns gRPC call options with `x-api-key` metadata for service-to-service auth.
- **`isTransientGrpcError(error)`** — Classifies gRPC status codes (UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED) for retry decisions.

## ESM Loader Bootstrap

Services that need OTel active before any application imports use the `register` entry point:

```json
{
  "scripts": {
    "start": "node --import @d2/service-defaults/register src/main.js"
  }
}
```

This calls `setupTelemetry()` via ESM loader hooks, ensuring instrumentation is installed before application modules load.

## .NET Equivalent

`D2.Shared.ServiceDefaults` — `AddServiceDefaults()` extension method configuring Serilog, OTel tracing/metrics, health checks, Prometheus exporter.
