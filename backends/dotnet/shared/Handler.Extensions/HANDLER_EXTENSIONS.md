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

## Request Context Population

The `RequestContext` implementation extracts information from the current HTTP request:

| Property              | Source                                             |
| --------------------- | -------------------------------------------------- |
| `TraceId`             | `Activity.Current?.TraceId`                        |
| `RequestId`           | `HttpContext.TraceIdentifier`                      |
| `RequestPath`         | `HttpContext.Request.Path`                         |
| `IsAuthenticated`     | `HttpContext.User.Identity.IsAuthenticated`        |
| `UserId`              | JWT `sub` claim                                    |
| `Username`            | JWT `name` claim                                   |
| `AgentOrgId`          | JWT `orgId` claim                                  |
| `AgentOrgName`        | JWT `orgName` claim                                |
| `AgentOrgType`        | JWT `orgType` claim → `OrgType` enum               |
| `IsAgentStaff`        | AgentOrgType ∈ {Admin, Support}                    |
| `IsAgentAdmin`        | AgentOrgType = Admin                               |
| `TargetOrgId`         | Emulated org ID (if emulating) ?? Agent org ID     |
| `TargetOrgName`       | Emulated org name (if emulating) ?? Agent org name |
| `TargetOrgType`       | Emulated org type (if emulating) ?? Agent org type |
| `IsTargetingStaff`    | TargetOrgType ∈ {Admin, Support}                   |
| `IsTargetingAdmin`    | TargetOrgType = Admin                              |
| `IsOrgEmulating`      | JWT `isEmulating` claim                            |
| `ImpersonatedBy`      | JWT `impersonatedBy` claim                         |
| `IsUserImpersonating` | JWT `isImpersonating` claim                        |
