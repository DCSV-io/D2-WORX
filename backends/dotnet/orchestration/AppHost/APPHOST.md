# AppHost

.NET Aspire orchestration project managing local development environment configuration. Uses `D2Env.Load()` to automatically load and transform environment variables from `.env.local` (or `.env`) into .NET configuration paths via convention-based mapping (see `D2Env` in Utilities). Defines service resources, dependencies, and inter-service communication patterns for the entire D²-WORX microservices stack.

## Files

| File Name                                                    | Description                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AppHost.cs](AppHost.cs)                                     | Main orchestration entry point. Calls `D2Env.Load()` before builder creation to map `.env.local` vars to Aspire parameters. Configures all service resources (Geo, Auth, Comms, REST gateway, PostgreSQL, Redis, RabbitMQ, Dkron, MinIO, observability stack) with service discovery, health checks, and dependency relationships. |
| [ServiceExtensions.cs](ServiceExtensions.cs)                 | Extension methods for resource configuration including database initialization, message broker setup, and shared infrastructure component registration with consistent naming conventions.                                                                                                                                         |
| [appsettings.json](appsettings.json)                         | Base configuration for Aspire dashboard and resource defaults used across all environments.                                                                                                                                                                                                                                        |
| [appsettings.Development.json](appsettings.Development.json) | Development-specific overrides for local debugging including connection strings, logging levels, and resource allocation settings.                                                                                                                                                                                                 |

## Observability Stack

The AppHost configures a full LGTM (Loki, Grafana, Tempo, Mimir) observability stack via Aspire container resources:

| Component     | Port(s)                  | Purpose                                                 |
| ------------- | ------------------------ | ------------------------------------------------------- |
| Grafana Alloy | 4317, 4318, 12345, 12347 | OTLP receiver (gRPC + HTTP), self-scrape, Faro receiver |
| Grafana       | 3000                     | Dashboards and visualization                            |
| Loki          | 3100                     | Log aggregation                                         |
| Tempo         | 3200, 4317               | Distributed tracing                                     |
| Mimir         | 9009                     | Metrics (Prometheus-compatible)                         |

### Grafana Faro (Client Telemetry)

Alloy exposes a `faro.receiver` on port **12347** for browser-side telemetry collection via Grafana Faro SDK. The receiver:

- Accepts HTTP POST from the Faro Web SDK (errors, traces, Web Vitals measurements)
- Processes logs through `loki.process` pipeline (service naming, level mapping, logfmt extraction)
- Extracts Web Vitals (TTFB, FCP, LCP, INP, CLS) as Prometheus histograms → Mimir
- Forwards browser traces through `otelcol.processor.transform` → Tempo

**Environment variables:**

| Variable                    | Description                                            | Example                                   |
| --------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `FARO_CORS_ORIGINS`         | Comma-separated allowed origins for Faro receiver      | `http://localhost:5173,https://t.dcsv.io` |
| `FARO_RECEIVER_PORT`        | Host port for Faro receiver                            | `12347`                                   |
| `PUBLIC_FARO_COLLECTOR_URL` | Client-facing Faro collector URL (passed to SvelteKit) | `https://t-d2-gf.dcsv.io/collect`         |

See [`observability/alloy/config/config.alloy`](../../../../observability/alloy/config/config.alloy) for the full Alloy configuration.
