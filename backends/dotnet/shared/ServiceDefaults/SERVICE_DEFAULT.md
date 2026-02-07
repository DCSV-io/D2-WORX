# ServiceDefaults

Shared Aspire configuration providing observability infrastructure (OpenTelemetry, Serilog), health checks, service discovery, and resilience patterns. Configures LGTM stack integration (Loki, Grafana, Tempo, Mimir) for all microservices.

## Files

| File Name                                                                                            | Description                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Extensions.cs](Extensions.cs)                                                                       | Public API for adding service defaults to IHostApplicationBuilder with structured logging, OpenTelemetry, health checks, and HTTP client configuration. Contains IP allowlist logic for metrics endpoint (localhost + Docker networks 172.17-20.0.0/16).                                                                                                                                                               |
| [Extensions.IHostApplicationBuilder.cs](Extensions.IHostApplicationBuilder.cs)                       | Internal implementation. `AddServiceDefaults()` calls `D2Env.Load()` + `AddEnvironmentVariables()` to pick up `.env` transforms, then configures Serilog (console + Loki sink), OpenTelemetry tracing/metrics (ASP.NET Core, gRPC, HTTP client, runtime, process), Prometheus exporter, OTLP trace exporter, and health checks. Filters out infrastructure endpoints (/health, /alive, /metrics) from traces and logs. |
| [Extensions.WebApplication.cs](Extensions.WebApplication.cs)                                         | WebApplication middleware configuration with UseStructuredRequestLogging (enriches logs with UserAgent, RemoteIp, TraceId), MapDefaultEndpoints (health/alive checks in dev only), and MapPrometheusEndpointWithIpRestriction (403 for unauthorized IPs).                                                                                                                                                              |
| [Logging/RedactDataDestructuringPolicy.cs](Logging/RedactDataDestructuringPolicy.cs)                 | Serilog `IDestructuringPolicy` that processes `[RedactData]` attributes during `{@obj}` destructuring. Replaces annotated values with `[REDACTED: {Reason}]` placeholders. Type-level attributes replace the entire value; property-level attributes mask individual fields. Uses `ConcurrentDictionary` reflection caching for performance.                                                                           |

---

## RedactDataDestructuringPolicy

Automatically redacts sensitive data during Serilog structured logging. Works with the `[RedactData]` attribute from `D2.Shared.Utilities.Attributes`.

### How It Works

When Serilog destructures an object (via `{@obj}` syntax), this policy intercepts the serialization:

1. **Type-level `[RedactData]`**: Entire object replaced with `[REDACTED: {Reason}]` scalar
2. **Property-level `[RedactData]`**: Individual properties masked, others destructured normally
3. **No `[RedactData]`**: Policy returns `false`, Serilog handles normally

### Reflection Caching

Type analysis runs once per type and is cached in a `ConcurrentDictionary<Type, TypeRedactionInfo>`. This means:
- First log of a type incurs reflection cost
- All subsequent logs of the same type are O(1) lookup

### Registration

Registered automatically in `Extensions.IHostApplicationBuilder.cs` via:

```csharp
.Destructure.With<RedactDataDestructuringPolicy>()
```

### Supported Patterns

```csharp
// Type-level — entire object replaced
[RedactData(Reason = RedactReason.PersonalInformation)]
public record SensitiveData(string Name, string Email);
// Logged as: [REDACTED: PersonalInformation]

// Property-level — individual fields masked
public record MixedData(
    [property: RedactData(Reason = RedactReason.PersonalInformation)] string IpAddress,
    string HandlerName);
// Logged as: { IpAddress: [REDACTED: PersonalInformation], HandlerName: "FindWhoIs" }

// Custom reason text
[RedactData(CustomReason = "Contains API keys")]
public record ApiConfig(string Key);
// Logged as: [REDACTED: Contains API keys]
```

### Interaction with DefaultOptions

`DefaultOptions` on `BaseHandler` controls _whether_ input/output is logged at all. `RedactDataDestructuringPolicy` controls _how_ objects are serialized when they are logged. Both mechanisms are complementary:

- Use `DefaultOptions` to suppress logging entirely for handlers with un-annotatable types (proto-generated DTOs)
- Use `[RedactData]` for fine-grained field masking on annotatable domain types
