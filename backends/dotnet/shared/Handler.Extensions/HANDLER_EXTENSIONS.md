# Handler.Extensions

DI registration extensions for handler context services. Provides `AddHandlerContext()` to register `IRequestContext` and `IHandlerContext` for use by handlers.

## Files

| File Name                                                    | Description                                                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Extensions.cs](Extensions.cs)                               | Extension methods for registering handler context services in DI containers.                                                       |
| [RequestContext.cs](RequestContext.cs)                       | Implementation of `IRequestContext` extracting context from HTTP requests, JWT claims, and org relationship.                       |
| [Auth/AuthPolicyExtensions.cs](Auth/AuthPolicyExtensions.cs) | `AddD2Policies()`, `RequireOrgType()`, `RequireRole()`, `RequireOrgTypeAndRole()` — declarative authorization policy registration. |

## Usage

Register handler context in your service's `Program.cs`:

```csharp
using D2.Shared.Handler.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Register handler context (IRequestContext + IHandlerContext).
builder.Services.AddHandlerContext();
```

## Registered Services

| Service           | Lifetime | Implementation   | Description                                                        |
| ----------------- | -------- | ---------------- | ------------------------------------------------------------------ |
| `IRequestContext` | Scoped   | `RequestContext` | Extracts trace IDs, user identity, and org info from HTTP context. |
| `IHandlerContext` | Scoped   | `HandlerContext` | Bundles `IRequestContext` and `ILogger` for handler injection.     |

## Dependencies

This package requires:

- `Microsoft.AspNetCore.App` framework reference (for `IHttpContextAccessor`)
- `Handler` project (for `IRequestContext`, `IHandlerContext`, `HandlerContext`)

## DI Factory Behavior

The `AddHandlerContext()` factory uses a two-tier resolution strategy for `IRequestContext`:

1. **Gateway path**: Checks `HttpContext.Features.Get<IRequestContext>()` for an existing `MutableRequestContext` (placed there by `RequestEnrichmentMiddleware`). If found, returns it directly — this instance has been progressively populated with network/enrichment fields, trust flag, and auth/org fields by the middleware pipeline.

2. **Non-gateway fallback**: If no existing instance is on Features (e.g., a standalone gRPC service like Geo), constructs a `RequestContext` from JWT claims. Network/enrichment fields (`ClientIp`, `DeviceFingerprint`, `WhoIsHashId`, etc.) return `null`, and `IsTrustedService` returns `false`.

This means handlers can always inject `IRequestContext` regardless of whether they run behind the gateway middleware pipeline or in a standalone gRPC service.

## RequestContext (JWT-Based) Population

The `RequestContext` implementation extracts identity/org information from JWT claims. Used by non-gateway gRPC services.

| Property                | Source                                             |
| ----------------------- | -------------------------------------------------- |
| `TraceId`               | `Activity.Current?.TraceId`                        |
| `RequestId`             | `HttpContext.TraceIdentifier`                      |
| `RequestPath`           | `HttpContext.Request.Path`                         |
| `IsAuthenticated`       | `HttpContext.User.Identity.IsAuthenticated`        |
| `UserId`                | JWT `sub` claim                                    |
| `Email`                 | JWT `email` claim                                  |
| `Username`              | JWT `name` claim                                   |
| `AgentOrgId`            | JWT `orgId` claim                                  |
| `AgentOrgName`          | JWT `orgName` claim                                |
| `AgentOrgType`          | JWT `orgType` claim → `OrgType` enum               |
| `AgentOrgRole`          | JWT `role` claim                                   |
| `IsAgentStaff`          | AgentOrgType ∈ {Admin, Support}                    |
| `IsAgentAdmin`          | AgentOrgType = Admin                               |
| `TargetOrgId`           | Emulated org ID (if emulating) ?? Agent org ID     |
| `TargetOrgName`         | Emulated org name (if emulating) ?? Agent org name |
| `TargetOrgType`         | Emulated org type (if emulating) ?? Agent org type |
| `TargetOrgRole`         | `"auditor"` (if emulating) ?? Agent org role       |
| `IsTargetingStaff`      | TargetOrgType ∈ {Admin, Support}                   |
| `IsTargetingAdmin`      | TargetOrgType = Admin                              |
| `IsOrgEmulating`        | JWT `isEmulating` claim                            |
| `ImpersonatedBy`        | JWT `impersonatedBy` claim                         |
| `ImpersonatingEmail`    | JWT `impersonatingEmail` claim                     |
| `ImpersonatingUsername` | JWT `impersonatingUsername` claim                  |
| `IsUserImpersonating`   | JWT `isImpersonating` claim                        |

Network/enrichment fields (`ClientIp`, `ServerFingerprint`, `ClientFingerprint`, `DeviceFingerprint`, `WhoIsHashId`, `City`, `CountryCode`, `SubdivisionCode`, `IsVpn`, `IsProxy`, `IsTor`, `IsHosting`) always return `null`. `IsTrustedService` always returns `false`. These fields are only populated by the gateway's `MutableRequestContext`.
