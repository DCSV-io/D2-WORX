### Module 24: REST Gateway + AppHost

**Files reviewed**: 12 source .cs files across 2 projects (excluding obj/ build artifacts)

**Projects**:
- `backends/dotnet/gateways/REST/` -- 10 source files (Program.cs, ResultExtensions.cs, Auth/JwtAuthOptions.cs, Auth/JwtAuthExtensions.cs, Auth/JwtFingerprintMiddleware.cs, Auth/JwtFingerprintValidator.cs, Auth/ServiceKeyEndpointFilter.cs, Auth/ServiceKeyExtensions.cs, Auth/ServiceKeyMiddleware.cs, Auth/ServiceKeyOptions.cs, Endpoints/GeoEndpoints.cs, Endpoints/HealthEndpoints.cs)
- `backends/dotnet/orchestration/AppHost/` -- 2 source files (AppHost.cs, ServiceExtensions.cs)
- Related test files reviewed: 8 files in `backends/dotnet/shared/Tests/Unit/Gateway/`

Also reviewed: `.csproj` files, `appsettings*.json` (4 files), `REST.md`, `APPHOST.md`, `.env.local.example`

---

**Assumptions documented**:

1. **Auth service is internal-only**: `jwt.RequireHttpsMetadata = false` assumes TLS termination is handled externally by a reverse proxy, and the Auth service JWKS endpoint is never directly exposed to the internet. (JwtAuthExtensions.cs:53)
2. **BetterAuth may not serve OIDC discovery**: `jwt.Configuration = null` with explicit `MetadataAddress` is a fallback assuming BetterAuth might not provide a standard `.well-known/openid-configuration` document. (JwtAuthExtensions.cs:78)
3. **JWT fingerprint uses exactly 2 headers**: SHA-256(User-Agent + "|" + Accept). Intentionally different from the 4-header server fingerprint used for analytics. Assumes parity with Node.js `session-fingerprint.ts`. (JwtFingerprintValidator.cs:17-21)
4. **Request enrichment always runs before service key detection**: ServiceKeyMiddleware reads `IRequestInfo` from `HttpContext.Features`, which is only populated by `RequestEnrichmentMiddleware`. If enrichment is skipped or fails, `IRequestInfo` may be null. (ServiceKeyMiddleware.cs:91-95)
5. **Geo service address uses Aspire service discovery format**: Config key `services:d2-geo:http:0` follows Aspire's convention for injecting service endpoints. (GeoEndpoints.cs:37)
6. **Comms service has a gRPC health check**: `CommsService.CommsServiceClient` is expected to have `CheckHealthAsync` RPC. (HealthEndpoints.cs:241)
7. **Auth service health is HTTP-only**: Auth has no gRPC server, so health checking uses HTTP GET to `/health-rich`. (HealthEndpoints.cs:307)
8. **PostgreSQL exporter uses interpolated credentials**: `DATA_SOURCE_NAME` string is built via C# string interpolation with Aspire `ParameterResource` objects (dbUsername, dbPassword). This relies on Aspire's `ReferenceExpression` interpolated string handler to resolve parameter values at container startup. (AppHost.cs:222-223)
9. **All OTel signals route through Grafana Alloy on localhost**: OTel environment variables hardcode `http://localhost:4318` as the OTLP receiver. This works in Aspire's local development model where containers share the host network. (ServiceExtensions.cs:56-57)
10. **Loki push URL defaults to port 3100**: The Serilog Loki sink default URL is `http://localhost:3100/loki/api/v1/push`. The Auth service also binds to port 3100. These are on different hostname:port combinations (Loki is internal container-to-container, Auth is exposed as `auth-http`). (ServiceExtensions.cs:57, AppHost.cs:71, AppHost.cs:299)
11. **Geo service gets both database-level and server-level PostgreSQL references**: `geoDb` (specific database) and `db` (server via `DefaultInfraRefs`) are both wired. Aspire resolves these as separate connection strings. (AppHost.cs:280-284)
12. **CORS default origin is SvelteKit dev server at localhost:5173**: If `CorsOrigin` config is not set, falls back to `http://localhost:5173`. (Program.cs:55)
13. **Request body limit is 256 KB**: Intentional constraint for a gateway that should only receive small JSON payloads. (Program.cs:61)
14. **MinIO init container runs only once per session**: Uses `ContainerLifetime.Session` so it reinitializes buckets on each `dotnet run` but not between container restarts. (AppHost.cs:61)
15. **cAdvisor binds host root filesystem read-only**: Mounts `/`, `/var/run`, `/sys`, `/var/lib/docker` for container metrics. This is a Linux-specific pattern that may not work on Windows/WSL2 without Docker Desktop. (AppHost.cs:114-117)

---

**Findings**:

| #  | Severity | Category        | File:Line                                       | Description                                                                                                                                                                                                                                                                                                                                                                                  |
|----|----------|-----------------|--------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | High     | Bug             | AppHost.cs:71,299                                | **Port collision: Loki and Auth both bind port 3100.** Loki uses `port: 3100, name: "loki-http"` and Auth uses `port: 3100, name: "auth-http"`, both with `isProxied: false`. Two containers cannot bind the same host port. Aspire will fail at startup when both containers try to claim port 3100. One of these needs a different host port (e.g., Auth could use 3101, or Loki could use 3100 internally with a different host port). |
| 2  | High     | Security        | Program.cs:57                                    | **CORS missing `X-Client-Fingerprint` header.** The CORS policy allows `Content-Type`, `Authorization`, and `Idempotency-Key` headers, but does NOT include `X-Client-Fingerprint`. Browser-initiated requests sending this header will be rejected by CORS preflight. Since rate limiting uses this header for the ClientFingerprint dimension, all browser requests will skip fingerprint-based rate limiting. Add `"X-Client-Fingerprint"` to `.WithHeaders()`. |
| 3  | Medium   | Consistency     | AppHost.cs:280-284                               | **Geo service gets redundant PostgreSQL server reference.** `geoService` has both `.WithReference(geoDb)` (database-level) AND `.DefaultInfraRefs(db, ...)` which calls `.WithReference(db)` (server-level). This injects two PostgreSQL connection strings: one for `d2-services-geo` database and one for the `postgres` default database on the server. The server-level reference is likely unnecessary and could confuse the service if it reads the wrong connection string. Consider modifying `DefaultInfraRefs` to exclude `db` for services that already have a database-level reference, or remove the server-level `WithReference` from `DefaultInfraRefs`. |
| 4  | Medium   | Performance     | HealthEndpoints.cs:408-413                       | **`GetStatus()` double-serializes via JSON roundtrip.** The method serializes an anonymous object to JSON string, then deserializes back to `JsonElement`, just to extract the `status` property. This runs 4 times per health check (lines 153-155, 160-165). Since the anonymous objects are known to have a `status` property, consider using a typed record or a shared interface to avoid the serialization overhead.                                         |
| 5  | Medium   | Consistency     | HealthEndpoints.cs:131-146                       | **Gateway health object shape differs from service health shapes.** The gateway result wraps its cache check in a nested `components.cache` structure, while service results use `MapGrpcHealthResponse` which puts components at the top level. The gateway also uses `status` at the top level set to the cache status, making the gateway entry redundant (top-level status == cache status). Consider aligning shapes or adding process-level health (uptime, memory) to the gateway entry. |
| 6  | Medium   | Maintainability | HealthEndpoints.cs:184-277                       | **Two near-identical `CheckGrpcServiceAsync` overloads.** One accepts `GeoService.GeoServiceClient` and the other accepts `CommsService.CommsServiceClient`. The method bodies are identical (same try/catch, same response mapping). These could be consolidated using a generic delegate or a shared helper that accepts a `Func<Task<CheckHealthResponse>>`.                                                                   |
| 7  | Medium   | Security        | Program.cs:55                                    | **Single CORS origin only.** The CORS policy uses `WithOrigins()` with a single string. In production, the SvelteKit app may be served from multiple origins (custom domains, staging environments). Consider supporting a comma-separated list or array in configuration.                                                                                                                     |
| 8  | Medium   | Maintainability | ServiceExtensions.cs:55-67                       | **OTel URLs hardcoded as method defaults.** The `WithOtelRefs()` method defaults `otlpBase` to `"http://localhost:4318"` and `lokiBase` to `"http://localhost:3100"`. These should ideally come from configuration or Aspire resource references rather than hardcoded defaults, to support non-localhost deployments without code changes.                                                        |
| 9  | Low      | Consistency     | JwtFingerprintMiddleware.cs:34-37                 | **Custom `JsonSerializerOptions` instead of shared `SerializerOptions.SR_IgnoreCycles`.** The middleware creates its own `sr_jsonOptions` with `JsonNamingPolicy.CamelCase`. The gateway's `ResultExtensions.cs` uses the shared `SerializerOptions.SR_IgnoreCycles` from `D2.Shared.Utilities.Serialization`. Consider reusing the shared options (with `PropertyNamingPolicy.CamelCase` added if not already present) for consistency. |
| 10 | Low      | Consistency     | ServiceKeyMiddleware.cs:80                        | **Inconsistent JSON serialization for error responses.** `ServiceKeyMiddleware` uses `WriteAsJsonAsync` with default serialization options (no explicit `JsonSerializerOptions`), while `JwtFingerprintMiddleware` uses explicit `sr_jsonOptions`. Both produce D2Result error responses but may serialize property names differently (PascalCase vs camelCase).                                                                    |
| 11 | Low      | Elegance        | GeoEndpoints.cs:37                               | **Config key uses `const string` in method body.** The configuration key `"services:d2-geo:http:0"` is defined as a local constant inside the extension method. For discoverability and consistency with the Options pattern used elsewhere, consider centralizing service address configuration keys.                                                                                             |
| 12 | Low      | Maintainability | HealthEndpoints.cs:49-56                          | **Comms gRPC client silently skipped if not configured.** If `services:d2-comms:comms-grpc:0` is missing, the `CommsService.CommsServiceClient` is never registered. The health endpoint will then fail at runtime with a DI resolution error for `CommsService.CommsServiceClient`. Either register a null/stub client, or handle the missing dependency gracefully in `CheckAllHealthAsync`. |
| 13 | Low      | Maintainability | AppHost.cs:114-117                               | **cAdvisor host filesystem mounts assume Linux.** The bind mounts for `/`, `/var/run`, `/sys`, `/var/lib/docker` are Linux-specific. On Windows with Docker Desktop (WSL2 backend), these may not resolve correctly. Consider documenting this limitation or adding a platform guard.                                                                                                            |
| 14 | Low      | Consistency     | REST.md                                          | **Documentation does not list HealthEndpoints, ServiceKey*, or idempotency middleware.** The REST.md file documents GeoEndpoints and JWT auth but does not mention: `HealthEndpoints.cs`, `ServiceKeyEndpointFilter.cs`, `ServiceKeyExtensions.cs`, `ServiceKeyMiddleware.cs`, `ServiceKeyOptions.cs`, or the idempotency/rate-limiting/request-enrichment middleware pipeline. The "Files" table and "Endpoints" section need updating. |
| 15 | Low      | Consistency     | APPHOST.md                                       | **APPHOST.md `ServiceExtensions.cs` description is vague.** Describes it as "database initialization, message broker setup, and shared infrastructure component registration" when it actually provides two methods: `DefaultInfraRefs` (PG+Redis+RabbitMQ wait+reference) and `WithOtelRefs` (OTel env vars). No mention of `D2Env.Load()` or the `.env.local` convention in the description.    |
| 16 | Low      | Elegance        | AppHost.cs:35                                    | **MinIO image tag uses specific timestamp tag** (`RELEASE.2025-09-07T16-13-09Z`). Unlike other images that use semver tags (e.g., `18.0-trixie`, `8.2.1-bookworm`), MinIO uses calendar-based tags. This is correct for MinIO's release convention, but the format is harder to compare for upgrade decisions. Consider adding a comment with the equivalent version number if known.              |

---

**Security analysis summary**:

1. **JWT validation: Strong.** RS256 only, issuer/audience validated, signed tokens required, clock skew limited to 30s, JWKS auto-refresh configured. `OnAuthenticationFailed` logs warnings without exposing details to client.
2. **Fingerprint binding: Good.** JWT `fp` claim validated against SHA-256(UA|Accept). Trusted services bypass. Missing `fp` claim on non-trusted requests returns 401. Case-insensitive comparison.
3. **Service key middleware: Correct.** Ordinal string comparison via `HashSet<string>`. Invalid key = 401 (fail fast). No key = pass-through (browser). Valid key sets `IsTrustedService` on `IRequestInfo`.
4. **Pipeline order: Correct.** ExceptionHandler -> StructuredLogging -> CORS -> RequestEnrichment -> ServiceKeyDetection -> RateLimiting -> Authentication -> FingerprintValidation -> Authorization -> Idempotency. Matches the documented pipeline order.
5. **CORS gap: Finding #2.** Missing `X-Client-Fingerprint` header means browser requests cannot send fingerprint for rate limiting. This is a functional gap, not a bypass vulnerability (rate limiting still applies via IP/city/country dimensions).
6. **No `OPTIONS` in CORS methods list.** The `.WithMethods()` call lists GET/POST/PUT/PATCH/DELETE but not OPTIONS. ASP.NET Core handles CORS preflight automatically, so this is not a bug, but worth noting.
7. **Authorization endpoints reviewed.** GET `/reference-data` is `AllowAnonymous` (correct, public data). POST `/reference-data/update` requires `RequireServiceKey()` (correct, service-only). Health endpoint is `AllowAnonymous` (correct, monitoring). Prometheus endpoint has IP restriction filter.

---

**AppHost configuration analysis**:

1. **Infrastructure resources: Complete.** PostgreSQL 18, Redis 8.2.1, RabbitMQ 4.1.4, MinIO, Dkron 4.0.9, full LGTM stack (Loki, Tempo, Mimir, Alloy, Grafana, cAdvisor).
2. **Service wiring: Correct.** Geo -> DB + Redis + RabbitMQ. Auth -> DB + Redis + RabbitMQ + Geo. Comms -> DB + RabbitMQ + Geo. REST -> Geo + Auth + Comms + Redis. SvelteKit -> REST gateway.
3. **Health checks: Only REST gateway.** `.WithHttpHealthCheck("/health")` on REST gateway only. Consider adding health checks for other services.
4. **Persistent containers: Appropriate.** Infrastructure (PG, Redis, RabbitMQ, observability) use `ContainerLifetime.Persistent`. MinIO init uses `Session`. Services are not containerized (they are projects or JavaScript apps).
5. **Wait dependencies: Mostly correct.** Auth and Comms both `WaitFor(geoService)` (correct -- they need Geo for geo-client calls). REST `WaitFor(geoService)` and `WaitFor(cache)`. Missing: REST does not `WaitFor(authService)` even though its JWKS validation depends on Auth being up (mitigated by JWKS retry/fallback behavior).
6. **Aspire SDK version: 13.0.0.** Latest stable as of early 2026. CommunityToolkit is beta (`13.0.0-beta.444`).

---

**Tests to add**:
- [ ] Test that CORS preflight allows `X-Client-Fingerprint` header (after fixing Finding #2)
- [ ] Integration test for health endpoint when Comms gRPC client is not registered (Finding #12 -- DI failure)
- [ ] Test `ResultExtensions.ToHttpResult` with various D2Result status codes (currently no unit tests for this extension method)
- [ ] Test health endpoint aggregation logic -- verify "degraded" status when any service is unhealthy
- [ ] Test health endpoint when Auth HTTP base address is null (the "not configured" branch)

**Tests to remove**: None -- existing 8 test files in `Unit/Gateway/` are well-structured and comprehensive (fingerprint middleware, validator, service key middleware, service key endpoint filter, JWT config, auth policies, request context JWT extraction, org emulation).
