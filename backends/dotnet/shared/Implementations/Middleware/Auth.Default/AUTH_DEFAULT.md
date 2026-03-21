# Auth.Default — JWT & Service Key Middleware

HTTP middleware providing two authentication mechanisms for the .NET REST gateway: JWT Bearer authentication with fingerprint binding for browser clients, and service API key authentication for trusted backend callers (e.g., SvelteKit server).

## Files

| File Name                                                  | Description                                                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [JwtAuthOptions.cs](JwtAuthOptions.cs)                     | Configuration options for JWT Bearer authentication.                                                     |
| [JwtAuthExtensions.cs](JwtAuthExtensions.cs)               | DI registration (`AddJwtAuth`) and middleware (`UseJwtAuth`) extension methods.                          |
| [JwtFingerprintMiddleware.cs](JwtFingerprintMiddleware.cs) | Middleware validating the JWT `fp` claim against the computed request fingerprint.                       |
| [JwtFingerprintValidator.cs](JwtFingerprintValidator.cs)   | Computes `SHA-256(User-Agent + "                                                                         | " + Accept)` for JWT fingerprint comparison. |
| [ServiceKeyOptions.cs](ServiceKeyOptions.cs)               | Configuration options for service-to-service API key authentication.                                     |
| [ServiceKeyExtensions.cs](ServiceKeyExtensions.cs)         | DI registration (`AddServiceKeyAuth`), middleware (`UseServiceKeyDetection`), and `RequireServiceKey()`. |
| [ServiceKeyMiddleware.cs](ServiceKeyMiddleware.cs)         | Middleware detecting and validating the `X-Api-Key` header, setting the trust flag.                      |
| [ServiceKeyEndpointFilter.cs](ServiceKeyEndpointFilter.cs) | Endpoint filter that gates access to `IsTrustedService == true` requests only.                           |

## JWT Authentication

### Overview

Configures ASP.NET JWT Bearer authentication against the Auth Service's JWKS endpoint. After standard JWT validation, a custom fingerprint middleware verifies that the JWT is being used from the same client that originally obtained it.

### Middleware Behavior

1. **JWT Bearer validation** (ASP.NET built-in) — validates signature (RS256 only), issuer, audience, lifetime.
2. **JwtFingerprintMiddleware** — runs after authentication:
   - No authenticated user — pass through (let auth middleware handle).
   - Trusted service (`IsTrustedService == true`) — skip fingerprint validation, populate auth state from claims.
   - No `fp` claim on a non-trusted request — 401 Unauthorized (`MISSING_FINGERPRINT`).
   - `fp` claim matches computed fingerprint — populate auth state, continue.
   - `fp` claim mismatch — 401 Unauthorized (`JWT_FINGERPRINT_MISMATCH`).
3. **Authorization** — ASP.NET authorization middleware with D2 policies (`Authenticated`, `HasActiveOrg`, `StaffOnly`, `AdminOnly`).

### Fingerprint Computation

`JwtFingerprintValidator.ComputeFingerprint` uses the same formula as the Node.js auth service (`session-fingerprint.ts`):

```
SHA-256(User-Agent + "|" + Accept)
```

This is intentionally different from `FingerprintBuilder` in RequestEnrichment.Default, which uses 4 headers for analytics/logging purposes.

### Auth State Population

After successful validation, `JwtFingerprintMiddleware.SetAuthState` populates the `MutableRequestContext` with identity and organization fields from JWT claims:

- **Identity**: `UserId`, `Email`, `Username`, `IsAuthenticated`
- **Agent Organization**: `AgentOrgId`, `AgentOrgName`, `AgentOrgType`, `AgentOrgRole`
- **Target Organization**: Same as agent org, OR emulated org if `IsOrgEmulating == true` (forced `auditor` role)
- **Impersonation**: `ImpersonatedBy`, `ImpersonatingEmail`, `ImpersonatingUsername`, `IsUserImpersonating`

### Configuration

| Property                  | Type       | Default      | Description                                                   |
| ------------------------- | ---------- | ------------ | ------------------------------------------------------------- |
| `AuthServiceBaseUrl`      | `string`   | `""`         | Base URL of the Auth Service for JWKS endpoint discovery.     |
| `Issuer`                  | `string`   | `""`         | Expected JWT `iss` claim value.                               |
| `Audience`                | `string`   | `""`         | Expected JWT `aud` claim value.                               |
| `ClockSkew`               | `TimeSpan` | `30 seconds` | Tolerance for token lifetime validation.                      |
| `JwksAutoRefreshInterval` | `TimeSpan` | `8 hours`    | Proactive JWKS key refresh interval.                          |
| `JwksRefreshInterval`     | `TimeSpan` | `5 minutes`  | Minimum cooldown between forced JWKS refreshes (unknown key). |

Config section: `GATEWAY_AUTH`

## Service Key Authentication

### Overview

Identifies trusted service-to-service requests via the `X-Api-Key` header. Operates in two stages: a global middleware sets the trust flag, and a per-endpoint filter enforces it.

### Middleware Behavior

**ServiceKeyMiddleware** (global, runs early in pipeline):

- No `X-Api-Key` header — mark `IsTrustedService = false` (confirmed not a trusted service), continue (browser request).
- Valid key — mark `IsTrustedService = true` (confirmed trusted), continue.
- Invalid key — 401 Unauthorized immediately (`INVALID_SERVICE_KEY`).

**ServiceKeyEndpointFilter** (per-endpoint, applied via `RequireServiceKey()`):

- Checks `IRequestContext.IsTrustedService`. If not `true`, returns 401.
- Does NOT validate the key itself — the middleware already did that.

### Key Validation Security

- **Timing-safe comparison**: Uses `CryptographicOperations.FixedTimeEquals` to prevent timing side-channel attacks.
- **All keys compared**: The loop always iterates through ALL configured keys regardless of match, preventing timing leaks on key position.
- **Pre-computed bytes**: Valid keys are converted to `byte[]` at startup (constructor), not per-request.

### Configuration

| Property    | Type           | Default | Description                                                                |
| ----------- | -------------- | ------- | -------------------------------------------------------------------------- |
| `ValidKeys` | `List<string>` | `[]`    | List of valid service API keys. Empty = all service key requests rejected. |

Config section: `GATEWAY_SERVICEKEY`

## Pipeline Placement

```
Request
  │
  ├─ UseRequestEnrichment()        ← creates MutableRequestContext
  ├─ UseServiceKeyDetection()      ← sets IsTrustedService flag
  ├─ UseRateLimiting()             ← trusted services bypass rate limits
  ├─ UseJwtAuth()                  ← authentication + fingerprint + authorization
  │    ├─ UseAuthentication()
  │    ├─ JwtFingerprintMiddleware
  │    └─ UseAuthorization()
  ├─ UseIdempotency()
  ├─ UseTranslation()
  └─ Endpoint
```

## Usage

```csharp
// Register services.
builder.Services.AddJwtAuth(builder.Configuration);
builder.Services.AddServiceKeyAuth(builder.Configuration);

// Add middleware.
app.UseServiceKeyDetection();      // After request enrichment, before rate limiting.
app.UseJwtAuth();                  // After rate limiting, before idempotency.

// Per-endpoint: require service key.
app.MapGet("/api/internal/data", handler).RequireServiceKey();

// Per-endpoint: require auth policy.
app.MapGet("/api/profile", handler).RequireAuthorization(AuthPolicies.AUTHENTICATED);
app.MapPost("/api/org/settings", handler).RequireAuthorization(AuthPolicies.HAS_ACTIVE_ORG);
```

## Auth Flag Semantics

`IsAuthenticated`, `IsTrustedService`, `IsOrgEmulating`, and `IsUserImpersonating` on `RequestContext` use `bool?` (nullable boolean):

| Value   | Meaning                                                                    |
| ------- | -------------------------------------------------------------------------- |
| `null`  | Not yet determined — auth middleware has not run yet (pre-auth)            |
| `false` | Confirmed not — middleware ran and determined the condition does not apply |
| `true`  | Confirmed yes — middleware ran and confirmed the condition                 |

**Initialization rules:**

- When `HttpContext` is null (e.g., gRPC service, background job), `IsAuthenticated` defaults to `false` (confirmed not authenticated — there is no HTTP request to authenticate).
- `IsOrgEmulating` derives from the JWT `isEmulating` claim — absent claim = `false` (not emulating).
- `IsUserImpersonating` derives from the JWT `isImpersonating` claim — absent claim = `false` (not impersonating).
- `IsTrustedService` is set by `ServiceKeyMiddleware`: no `X-Api-Key` header = `false`, valid key = `true`, invalid key = 401.

**Usage:** Never treat `null` as `false`. Use explicit checks: `if (ctx.IsAuthenticated != true)` or `if (ctx.IsAuthenticated is null or false)`. See `IRequestContext` field tables in [HANDLER.md](../../../Handler/HANDLER.md).

## Security Notes

- **RS256 only**: `ValidAlgorithms` is locked to `["RS256"]`. No EdDSA, no HS256.
- **Fail-closed**: Empty `ValidKeys` list means all `X-Api-Key` requests are rejected. Missing JWT config fields cause authentication failures.
- **Fingerprint binding**: Prevents stolen JWT reuse from different clients. The `fp` claim is required for all non-trusted requests.
- **HTTPS not required for internal traffic**: `RequireHttpsMetadata = false` because TLS termination is at the reverse proxy. The Auth Service is never exposed to the internet.

## Dependencies

- `D2.Shared.Handler` — `IRequestContext`, `JwtClaimTypes`, `OrgType`, `AuthPolicies`, `OrgTypeValues`, `RoleValues`.
- `D2.Shared.Handler.Extensions` — `AddD2Policies()` authorization policy registration.
- `D2.Shared.Result` — `D2Result` for error responses.
- `D2.Shared.Utilities` — `Falsey()` extension, `SerializerOptions`.
- `RequestEnrichment.Default` — `MutableRequestContext` for setting auth state.
- `Microsoft.AspNetCore.Authentication.JwtBearer` — JWT Bearer handler.
