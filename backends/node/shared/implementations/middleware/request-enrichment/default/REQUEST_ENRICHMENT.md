# @d2/request-enrichment

Request enrichment middleware for IP resolution, fingerprinting, and WhoIs lookup. Mirrors `RequestEnrichment.Default` in .NET. Layer 5.

## Files

| File Name                                                                  | Description                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [enrich-request.ts](src/enrich-request.ts)                                 | `enrichRequest()` — main orchestration function combining all enrichment steps.         |
| [ip-resolver.ts](src/ip-resolver.ts)                                       | `resolveIp()` + `isLocalhost()` — extract client IP from proxy headers.                 |
| [fingerprint-builder.ts](src/fingerprint-builder.ts)                       | `buildServerFingerprint()` — SHA-256 hash of User-Agent + Accept headers.               |
| [request-info.ts](src/request-info.ts)                                     | `RequestInfo` class implementing `IRequestInfo` from `@d2/interfaces`.                  |
| [request-enrichment-options.ts](src/request-enrichment-options.ts)         | `RequestEnrichmentOptions` + `DEFAULT_REQUEST_ENRICHMENT_OPTIONS`.                      |
| [index.ts](src/index.ts)                                                   | Barrel re-export of `enrichRequest`, helpers, and types.                                |

## Logic Flow

1. **Resolve IP** — `CF-Connecting-IP` → `X-Real-IP` → `X-Forwarded-For` → socket address
2. **Build fingerprints** — Server: SHA-256(UA + Accept). Client: from `X-Client-Fingerprint` header
3. **WhoIs lookup** — Calls `FindWhoIs` handler (from `@d2/geo-client`) for city/country/VPN data
4. **Return `IRequestInfo`** — Populated object for downstream middleware (rate limiting, logging)

## Fail-Open

Always succeeds — if WhoIs lookup fails or IP resolution returns localhost, the `IRequestInfo` is still populated with whatever data is available. Missing fields are `undefined`, not errors.

## .NET Equivalent

`RequestEnrichment.Default` — HTTP middleware that resolves IP, builds fingerprint, calls `FindWhoIs`, and sets `IRequestInfo` on `HttpContext.Features`.
