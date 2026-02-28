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
| [grpc/handle-rpc.ts](src/grpc/handle-rpc.ts)                           | `handleRpc()` — general-purpose gRPC unary handler with scope/mapping/error handling.            |
| [grpc/handle-job-rpc.ts](src/grpc/handle-job-rpc.ts)                   | `handleJobRpc()` — thin wrapper around `handleRpc` with job-specific defaults.                   |
| [config/parse-env-array.ts](src/config/parse-env-array.ts)             | `parseEnvArray()` — reads indexed env vars into a string array.                                  |
| [config/parse-postgres-url.ts](src/config/parse-postgres-url.ts)       | `parsePostgresUrl()` — converts ADO.NET connection strings to `postgresql://` URIs.              |
| [config/parse-redis-url.ts](src/config/parse-redis-url.ts)             | `parseRedisUrl()` — converts StackExchange.Redis connection strings to `redis://` URIs.          |
| [config/index.ts](src/config/index.ts)                                 | Barrel re-export for config utilities. Import via `@d2/service-defaults/config`.                 |
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

## Config Utilities

Shared Aspire connection-string parsers and env-var helpers, importable via `@d2/service-defaults/config`:

```typescript
import { parseEnvArray, parsePostgresUrl, parseRedisUrl } from "@d2/service-defaults/config";
```

| File                                                             | Description                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| [config/parse-env-array.ts](src/config/parse-env-array.ts)       | Reads indexed env vars (`PREFIX__0`, `__1`, ...) into a string array. |
| [config/parse-postgres-url.ts](src/config/parse-postgres-url.ts) | Converts ADO.NET connection strings to `postgresql://` URIs.          |
| [config/parse-redis-url.ts](src/config/parse-redis-url.ts)       | Converts StackExchange.Redis connection strings to `redis://` URIs.   |
| [config/index.ts](src/config/index.ts)                           | Barrel re-export for all config utilities.                            |

- **`parseEnvArray(prefix)`** — Reads `${prefix}__0`, `${prefix}__1`, ... until a gap is found. Matches .NET's indexed-array binding convention.
- **`parsePostgresUrl(connectionString)`** — Converts ADO.NET format (`Host=...;Port=...;Username=...;Password=...;Database=...`) to libpq URI (`postgresql://user:pass@host:port/db`). Passes through existing `postgresql://` or `postgres://` URIs unchanged.
- **`parseRedisUrl(connectionString)`** — Converts StackExchange format (`host:port,password=pass`) to Redis URI (`redis://:pass@host:port`). Passes through existing `redis://` or `rediss://` URIs unchanged.

These utilities are used by both `auth-api` and `comms-api` composition roots to bridge the gap between Aspire-injected .NET connection strings and Node.js client libraries.

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
  handleRpc,
  handleJobRpc,
} from "@d2/service-defaults/grpc";
```

- **`createRpcScope(provider, metadata)`** — Creates a per-RPC DI scope with auto-generated traceId and HandlerContext. Used in gRPC service implementations.
- **`extractGrpcTraceContext(metadata)`** — Extracts OTel trace context from incoming gRPC metadata for context propagation.
- **`withTraceContext(metadata)`** — Injects current OTel trace context into outgoing gRPC metadata.
- **`withApiKeyAuth(apiKey)`** — Returns gRPC call options with `x-api-key` metadata for service-to-service auth.
- **`isTransientGrpcError(error)`** — Classifies gRPC status codes (UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED) for retry decisions.
- **`handleRpc(provider, call, callback, options)`** — General-purpose gRPC unary handler. Creates a DI scope via `createRpcScope`, resolves the handler by `options.handlerKey`, calls `options.mapInput(request)` to produce handler input, executes the handler, calls `options.mapResponse(result)` to produce the proto response, and handles errors + scope disposal. The `HandleRpcOptions<TRequest, TResponse, TInput, TOutput>` interface defines `handlerKey`, `mapInput`, `mapResponse`, and optional `scopeOptions`. Use this for regular (non-job) RPCs where you need full control over input/output mapping.
- **`handleJobRpc(provider, call, callback, handlerKey, jobName)`** — Thin wrapper around `handleRpc` with job-specific defaults: empty input (`{}`), standard `TriggerJobResponse` mapping with `jobName`, `rowsAffected`, `durationMs`, `lockAcquired`, and `executedAt`. Used by Auth (4 RPCs) and Comms (2 RPCs) job services.

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
