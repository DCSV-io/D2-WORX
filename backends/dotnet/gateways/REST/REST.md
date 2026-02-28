# REST

HTTP/REST gateway providing public API access to D² microservices via gRPC backend calls. Thin routing layer with versioned APIs, OpenAPI documentation, and standardized error handling.

## Files

| File Name                                                       | Description                                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [Program.cs](Program.cs)                                        | Service bootstrap with gRPC clients, endpoint registration, and OpenAPI.                                       |
| [ResultExtensions.cs](ResultExtensions.cs)                      | Extension methods for converting gRPC responses to HTTP results.                                               |
| [GeoEndpoints.cs](Endpoints/GeoEndpoints.cs)                    | Geo service endpoints and gRPC client registration.                                                            |
| [REST.http](REST.http)                                          | HTTP request file for testing endpoints in Rider/VS Code.                                                      |
| [JwtAuthExtensions.cs](Auth/JwtAuthExtensions.cs)               | `AddJwtAuth()` + `UseJwtAuth()` — JWT Bearer authentication via JWKS endpoint with RS256, policy registration. |
| [JwtAuthOptions.cs](Auth/JwtAuthOptions.cs)                     | Configuration: BaseUrl, Issuer, Audience, ClockSkew for JWT validation.                                        |
| [JwtFingerprintMiddleware.cs](Auth/JwtFingerprintMiddleware.cs) | Middleware validating JWT `fp` claim against computed SHA-256(UA\|Accept). Fail-open, backwards-compatible.    |
| [JwtFingerprintValidator.cs](Auth/JwtFingerprintValidator.cs)   | `ComputeFingerprint()` — SHA-256(User-Agent + "\|" + Accept) for stolen token detection.                       |
| [ServiceKeyMiddleware.cs](Auth/ServiceKeyMiddleware.cs)         | Middleware validating `X-Api-Key` header. Sets `IRequestInfo.IsTrustedService` flag. Invalid key → 401.        |
| [ServiceKeyEndpointFilter.cs](Auth/ServiceKeyEndpointFilter.cs) | Endpoint filter checking `IsTrustedService` flag (used by `RequireServiceKey()` extension).                    |
| [ServiceKeyExtensions.cs](Auth/ServiceKeyExtensions.cs)         | `AddServiceKeyAuth()`, `UseServiceKeyDetection()`, `RequireServiceKey()` extension methods.                    |
| [ServiceKeyOptions.cs](Auth/ServiceKeyOptions.cs)               | Configuration: `ValidKeys` list of trusted service API keys.                                                   |
| [AuthJobEndpoints.cs](Endpoints/AuthJobEndpoints.cs)            | Auth scheduled job endpoints — proxies to Auth gRPC `AuthJobService`.                                          |
| [GeoJobEndpoints.cs](Endpoints/GeoJobEndpoints.cs)              | Geo scheduled job endpoints — proxies to Geo gRPC `GeoJobService`.                                             |
| [CommsJobEndpoints.cs](Endpoints/CommsJobEndpoints.cs)          | Comms scheduled job endpoints — proxies to Comms gRPC `CommsJobService`.                                       |
| [HealthEndpoints.cs](Endpoints/HealthEndpoints.cs)              | Aggregated health check endpoint fanning out to Geo, Auth, Comms, and gateway cache.                           |

## API Versioning

All endpoints use URL path versioning (`/api/v1/...`). This approach was chosen for:

- Explicit version visibility in URLs
- Easy testing via browser/curl
- Simple routing without header inspection

## Endpoints

### Health (`/api/health`)

| Method | Path          | Description                                                                |
| ------ | ------------- | -------------------------------------------------------------------------- |
| GET    | `/api/health` | Aggregated health check — fans out to Geo, Auth, Comms, and gateway cache. |

Returns `200` (all healthy) or `503` (degraded) with per-service status, latency, and component breakdown. Geo/Comms via gRPC `CheckHealth`, Auth via HTTP `/health-rich`, gateway cache via distributed cache ping handler.

### Geo (`/api/v1/geo`)

| Method | Path                     | Description                                                                      |
| ------ | ------------------------ | -------------------------------------------------------------------------------- |
| GET    | `/reference-data`        | Returns full geographic reference data.                                          |
| POST   | `/reference-data/update` | Requests that geographic reference data be updated. Returns the updated version. |

### Auth Jobs (`/api/v1/auth/jobs`)

All job endpoints require `RequireServiceKey()` — accessible only to Dkron or internal callers.

| Method | Path                          | Description                                        |
| ------ | ----------------------------- | -------------------------------------------------- |
| POST   | `/purge-sessions`             | Purges expired auth sessions.                      |
| POST   | `/purge-sign-in-events`       | Purges old sign-in events beyond retention period. |
| POST   | `/cleanup-invitations`        | Cleans up expired org invitations.                 |
| POST   | `/cleanup-emulation-consents` | Cleans up expired or revoked emulation consents.   |

### Geo Jobs (`/api/v1/geo/jobs`)

| Method | Path                          | Description                                              |
| ------ | ----------------------------- | -------------------------------------------------------- |
| POST   | `/purge-stale-whois`          | Purges WhoIs records older than the retention period.    |
| POST   | `/cleanup-orphaned-locations` | Cleans up locations with no contact or WhoIs references. |

### Comms Jobs (`/api/v1/comms/jobs`)

| Method | Path                      | Description                                           |
| ------ | ------------------------- | ----------------------------------------------------- |
| POST   | `/purge-deleted-messages` | Purges soft-deleted messages beyond retention period. |
| POST   | `/purge-delivery-history` | Purges old delivery request and attempt history.      |

## Endpoint Organization

Endpoints are organized by service/area using C# 14 extension blocks:

```csharp
// Program.cs — gRPC client registration
builder.Services.AddGeoGrpcClient(builder.Configuration);
builder.Services.AddAuthJobsGrpcClient(builder.Configuration);
builder.Services.AddGeoJobsGrpcClient(builder.Configuration);
builder.Services.AddCommsJobsGrpcClient(builder.Configuration);

// Program.cs — endpoint mapping
app.MapGeoEndpointsV1();
app.MapAuthJobEndpointsV1();
app.MapGeoJobEndpointsV1();
app.MapCommsJobEndpointsV1();
```

Each `*Endpoints.cs` file contains:

- `Add*GrpcClient()` — Registers the gRPC client with Aspire service discovery
- `Map*EndpointsV1()` — Maps the REST endpoints using `MapGroup()` for route prefixing

## gRPC Client Registration

Clients use Aspire service configuration for service discovery. Job-service clients also attach `x-api-key` via `AddCallCredentials` so the target gRPC server can validate trusted callers.

```csharp
// Standard pattern — Geo data client (no API key needed)
const string config_key = "services:d2-geo:http:0";
var geoAddress = configuration[config_key];
services.AddGrpcClient<GeoService.GeoServiceClient>(o =>
{
    o.Address = new Uri(geoAddress!);
});

// Job client pattern — Auth job client (with API key call credentials)
var apiKey = configuration["GATEWAY_AUTH_GRPC_API_KEY"];
services.AddGrpcClient<AuthJobService.AuthJobServiceClient>(o =>
{
    o.Address = new Uri(authGrpcAddress!);
})
.AddCallCredentials((context, metadata) =>
{
    if (!string.IsNullOrWhiteSpace(apiKey))
    {
        metadata.Add("x-api-key", apiKey);
    }
    return Task.CompletedTask;
});
```

### Job Client Configuration Keys

| Client                                  | Aspire Config Key                | API Key Env Var              |
| --------------------------------------- | -------------------------------- | ---------------------------- |
| `AuthJobService.AuthJobServiceClient`   | `services:d2-auth:auth-grpc:0`   | `GATEWAY_AUTH_GRPC_API_KEY`  |
| `GeoJobService.GeoJobServiceClient`     | `services:d2-geo:http:0`         | `GATEWAY_GEO_GRPC_API_KEY`   |
| `CommsJobService.CommsJobServiceClient` | `services:d2-comms:comms-grpc:0` | `GATEWAY_COMMS_GRPC_API_KEY` |

## Error Handling

All responses return a `D2Result<T>` with the HTTP status code derived from `D2Result.StatusCode`:

```json
{
  "success": true,
  "statusCode": 200,
  "errorCode": null,
  "traceId": "abc123",
  "messages": [],
  "inputErrors": [],
  "data": {}
}
```

On failure:

```json
{
  "success": false,
  "statusCode": 404,
  "errorCode": "NOT_FOUND",
  "traceId": "abc123",
  "messages": ["Resource not found"],
  "inputErrors": [],
  "data": null
}
```

This uses the existing `ToD2Result()` extension from `Result.Extensions` to convert `D2ResultProto` to `D2Result<T>`, ensuring consistent response shapes across the entire system.

## Architecture

```
Client (HTTP)
    │
    └──► REST Gateway (/api/v1/geo/...)
            │
            └──► GeoService.GeoServiceClient (gRPC)
                    │
                    └──► Geo.API (d2-geo)
```

## OpenTelemetry

Trace propagation flows automatically through the gRPC client thanks to:

- `OpenTelemetry.Instrumentation.AspNetCore` (incoming HTTP)
- `OpenTelemetry.Instrumentation.GrpcNetClient` (outgoing gRPC)

Both are registered via `AddServiceDefaults()`.

## Service-to-Service Authentication

Trusted backend callers (e.g., SvelteKit server) authenticate via `X-Api-Key` header:

1. `ServiceKeyMiddleware` validates the key early in the pipeline (after request enrichment, before rate limiting)
2. Valid key → sets `IRequestInfo.IsTrustedService = true` (trusted services bypass rate limiting and fingerprint validation)
3. Invalid key → 401 immediately (fail fast)
4. No key → browser request, continues normally
5. `RequireServiceKey()` endpoint filter checks the trust flag on service-only endpoints

**Pipeline order:** RequestEnrichment → ServiceKeyDetection → RateLimiting → JwtAuth → JwtFingerprint → Endpoints

**Registration:** `AddServiceKeyAuth(configuration)` + `UseServiceKeyDetection()` in `Program.cs`.
