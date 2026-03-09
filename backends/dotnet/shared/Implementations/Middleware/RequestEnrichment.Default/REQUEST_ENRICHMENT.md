# RequestEnrichment.Default

HTTP middleware that enriches requests with client information including IP resolution, fingerprinting, and WhoIs geolocation data.

## Files

| File Name                                                        | Description                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [IRequestInfo.cs](IRequestInfo.cs)                               | Interface defining enriched request context properties.                   |
| [RequestInfo.cs](RequestInfo.cs)                                 | Concrete implementation of IRequestInfo.                                  |
| [IpResolver.cs](IpResolver.cs)                                   | Static helper for resolving client IP from various headers.               |
| [FingerprintBuilder.cs](FingerprintBuilder.cs)                   | Static helpers for server + device fingerprint computation.               |
| [RequestEnrichmentOptions.cs](RequestEnrichmentOptions.cs)       | Configuration options for the middleware.                                 |
| [RequestEnrichmentMiddleware.cs](RequestEnrichmentMiddleware.cs) | The middleware implementation that performs enrichment.                   |
| [Extensions.cs](Extensions.cs)                                   | DI registration and app builder extension methods.                        |

## Overview

The middleware performs the following enrichment steps:

1. **IP Resolution** — Resolves client IP from headers in priority order:
   - `CF-Connecting-IP` (Cloudflare)
   - `X-Real-IP` (Nginx/reverse proxy)
   - `X-Forwarded-For` (first entry)
   - `HttpContext.Connection.RemoteIpAddress` (fallback)

2. **Server Fingerprint** — Computes SHA-256 hash of request headers for logging/analytics:
   - `User-Agent + "|" + Accept-Language + "|" + Accept-Encoding + "|" + Accept`

3. **Client Fingerprint** — Reads from `d2-cfp` cookie (primary) or `X-Client-Fingerprint` header (fallback). May be absent.

4. **Device Fingerprint** — Computes `SHA-256(clientFingerprint + serverFingerprint + clientIp)`. Always present — if client fingerprint is missing, degrades to `SHA-256("" + serverFP + clientIp)`.

5. **WhoIs Lookup** — Calls Geo.Client's WhoIs cache handler to enrich with geolocation data:
   - City, country code, subdivision code
   - VPN/proxy/Tor/hosting flags
   - Content-addressable hash ID for downstream lookups

## IRequestInfo Properties

| Property            | Type      | Description                                               |
| ------------------- | --------- | --------------------------------------------------------- |
| `ClientIp`          | `string`  | Resolved client IP address (always present).              |
| `ServerFingerprint` | `string`  | Server-computed fingerprint for logging (always present). |
| `ClientFingerprint` | `string?` | Client-provided fingerprint from cookie/header (nullable). |
| `DeviceFingerprint` | `string`  | Combined fingerprint: SHA-256(clientFP + serverFP + IP). Always present. |
| `UserId`            | `string?` | User ID set by auth middleware (nullable, mutable).       |
| `IsAuthenticated`   | `bool`    | Authentication status set by auth middleware (mutable).   |
| `WhoIsHashId`       | `string?` | Content-addressable hash for WhoIs lookups.               |
| `City`              | `string?` | City from WhoIs data.                                     |
| `CountryCode`       | `string?` | ISO 3166-1 alpha-2 country code.                          |
| `SubdivisionCode`   | `string?` | ISO 3166-2 subdivision code.                              |
| `IsVpn`             | `bool?`   | Whether IP is from a VPN.                                 |
| `IsProxy`           | `bool?`   | Whether IP is from a proxy.                               |
| `IsTor`             | `bool?`   | Whether IP is from a Tor exit node.                       |
| `IsHosting`         | `bool?`   | Whether IP is from a hosting provider.                    |

## Configuration

```csharp
public class RequestEnrichmentOptions
{
    // Enable/disable WhoIs lookup (default: true).
    public bool EnableWhoIsLookup { get; set; } = true;

    // Header name for client fingerprint fallback (default: "X-Client-Fingerprint").
    public string ClientFingerprintHeader { get; set; } = "X-Client-Fingerprint";

    // Cookie name for client fingerprint (default: "d2-cfp").
    public string ClientFingerprintCookie { get; set; } = "d2-cfp";
}
```

## Usage

```csharp
// In Program.cs or Startup.cs

// Register services.
builder.Services.AddRequestEnrichment(builder.Configuration);

// Add middleware (after exception handler, before rate limiting).
app.UseRequestEnrichment();
```

## Fail-Open Behavior

- **WhoIs lookup fails**: Log warning, continue with IP/fingerprint only.
- **Localhost detected**: Skip WhoIs lookup entirely.

## Dependencies

- `D2.Geo.Client` — For WhoIs cache handler (`IComplex.IFindWhoIsHandler`).
- `Microsoft.AspNetCore.Http` — For HTTP context and features.
