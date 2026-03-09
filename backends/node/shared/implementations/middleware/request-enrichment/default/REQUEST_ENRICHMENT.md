# @d2/request-enrichment

Request enrichment middleware for IP resolution, fingerprinting, and WhoIs lookup. Mirrors `RequestEnrichment.Default` in .NET. Layer 5.

## Files

| File Name                                                          | Description                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| [enrich-request.ts](src/enrich-request.ts)                         | `enrichRequest()` — main orchestration function combining all enrichment steps. |
| [ip-resolver.ts](src/ip-resolver.ts)                               | `resolveIp()` + `isLocalhost()` — extract client IP from proxy headers.         |
| [fingerprint-builder.ts](src/fingerprint-builder.ts)               | `buildServerFingerprint()` + `buildDeviceFingerprint()` — SHA-256 hashing.      |
| [request-info.ts](src/request-info.ts)                             | `RequestInfo` class implementing `IRequestInfo` from `@d2/interfaces`.          |
| [request-enrichment-options.ts](src/request-enrichment-options.ts) | `RequestEnrichmentOptions` + `DEFAULT_REQUEST_ENRICHMENT_OPTIONS`.              |
| [index.ts](src/index.ts)                                           | Barrel re-export of `enrichRequest`, helpers, and types.                        |

## Logic Flow

1. **Resolve IP** — `CF-Connecting-IP` → `X-Real-IP` → `X-Forwarded-For` → socket address
2. **Build server fingerprint** — SHA-256(UA + Accept headers)
3. **Read client fingerprint** — From `d2-cfp` cookie (primary) or `X-Client-Fingerprint` header (fallback). May be absent
4. **Compute device fingerprint** — `SHA-256(clientFP + serverFP + clientIp)`. Always present — degrades gracefully when client FP is missing
5. **WhoIs lookup** — Calls `FindWhoIs` handler (from `@d2/geo-client`) for city/country/VPN data
6. **Return `IRequestInfo`** — Populated object for downstream middleware (rate limiting, logging)

## Fail-Open

Always succeeds — if WhoIs lookup fails or IP resolution returns localhost, the `IRequestInfo` is still populated with whatever data is available. Missing fields are `undefined`, not errors. Device fingerprint is always computed (never `undefined`).

## .NET Equivalent

`RequestEnrichment.Default` — HTTP middleware that resolves IP, builds fingerprint, calls `FindWhoIs`, and sets `IRequestInfo` on `HttpContext.Features`.
