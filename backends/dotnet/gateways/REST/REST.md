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

## API Versioning

All endpoints use URL path versioning (`/api/v1/...`). This approach was chosen for:

- Explicit version visibility in URLs
- Easy testing via browser/curl
- Simple routing without header inspection

## Endpoints

### Geo (`/api/v1/geo`)

| Method | Path                     | Description                                                                      |
| ------ | ------------------------ | -------------------------------------------------------------------------------- |
| GET    | `/reference-data`        | Returns full geographic reference data.                                          |
| POST   | `/reference-data/update` | Requests that geographic reference data be updated. Returns the updated version. |

## Endpoint Organization

Endpoints are organized by service/area using C# 14 extension blocks:

```csharp
// Program.cs
builder.Services.AddGeoGrpcClient();  // Register gRPC client
app.MapGeoEndpointsV1();              // Map endpoints

// Future services follow the same pattern:
// builder.Services.AddAuthGrpcClient();
// app.MapAuthEndpointsV1();
```

Each `*Endpoints.cs` file contains:

- `Add*GrpcClient()` — Registers the gRPC client with Aspire service discovery
- `Map*EndpointsV1()` — Maps the REST endpoints using `MapGroup()` for route prefixing

## gRPC Client Registration

Clients use Aspire service configuration for service discovery. Example for Geo service:

```csharp
const string config_key = "services:d2-geo:http:0";
var geoAddress = configuration[config_key];
if (geoAddress.Falsey())
{
    throw new ArgumentException(
        $"Geo service address not configured. Missing '{config_key}' configuration.");
}

services.AddGrpcClient<GeoService.GeoServiceClient>(o =>
{
    o.Address = new Uri(geoAddress!);
});

return services;
```

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
