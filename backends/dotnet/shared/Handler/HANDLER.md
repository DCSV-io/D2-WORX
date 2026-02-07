# Handler

Handler infrastructure implementing CQRS pattern with automatic logging, tracing, and error handling. Base classes for commands/queries with D2Result integration and OpenTelemetry instrumentation.

## Files

| File Name                                            | Description                                                                                                                                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [IHandler.cs](IHandler.cs)                           | Generic handler interface defining async operation contracts with input/output types, cancellation tokens, and optional handler configuration.                                                            |
| [BaseHandler.cs](BaseHandler.cs)                     | Abstract base handler with built-in OpenTelemetry tracing, structured logging, execution timing, and exception handling wrapper around ExecuteAsync.                                                      |
| [IHandlerContext.cs](IHandlerContext.cs)             | Context interface bundling IRequestContext and ILogger to reduce constructor boilerplate across handlers.                                                                                                 |
| [HandlerContext.cs](HandlerContext.cs)               | Default implementation of IHandlerContext providing request context and logging access.                                                                                                                   |
| [IRequestContext.cs](IRequestContext.cs)             | Request-scoped identity context with trace IDs, user authentication state, agent/target organization details, and relationship helpers.                                                                   |
| [HandlerOptions.cs](HandlerOptions.cs)               | Configuration record for handler execution behavior including input/output logging, time warning thresholds, and suppression flags.                                                                      |
| [BHASW.cs](BHASW.cs)                                 | Internal static class providing ActivitySource for OpenTelemetry distributed tracing of handler operations. Acronym: Base Handler Activity Source Wrapper.                                                |
| [OrgType.cs](OrgType.cs)                             | Enum defining organization types: Admin (full system access), Support (customer support capabilities), Affiliate (partners/resellers), Customer (standard users), CustomerClient (external subsidiaries). |
| [UserToOrgRelationship.cs](UserToOrgRelationship.cs) | Enum defining user-organization relationship types: DirectMember (direct membership), AssociatedMember (affiliate/partner association), Emulation (impersonation/emulation access).                       |

---

## HandlerOptions

Configuration record controlling handler logging and timing behavior. Used both as per-call options and as handler-level defaults via `DefaultOptions`.

```csharp
public record HandlerOptions(
    bool SuppressTimeWarnings = false,  // Skip elapsed-time warning/critical log levels
    bool LogInput = true,               // Log input at Debug level via Serilog {@Input} destructuring
    bool LogOutput = true,              // Log output at Debug level via Serilog {@Output} destructuring
    long WarningThresholdMs = 100,      // Elapsed time threshold for Warning log level
    long CriticalThresholdMs = 500);    // Elapsed time threshold for Critical log level
```

## DefaultOptions

`BaseHandler` exposes a `virtual HandlerOptions DefaultOptions` property that subclasses override to set handler-level logging defaults. When `HandleAsync` receives `null` for the `options` parameter, it falls through to `DefaultOptions`.

**Resolution order:** Per-call options (if provided) > `DefaultOptions` override (if handler defines one) > base defaults (`new HandlerOptions()`).

```csharp
// Handler that suppresses I/O logging by default (e.g., handles proto-generated PII data)
protected override HandlerOptions DefaultOptions => new(LogInput: false, LogOutput: false);

// Caller can still override per-call:
await handler.HandleAsync(input, ct, options: new HandlerOptions(LogInput: true));
```

**Interaction with `[RedactData]`:** `DefaultOptions` controls whether `BaseHandler` logs input/output at all. The `RedactDataDestructuringPolicy` (in ServiceDefaults) handles _how_ logged objects are serialized — masking `[RedactData]`-annotated fields. Both mechanisms work together: `DefaultOptions` is the coarse switch, `[RedactData]` is the fine-grained field-level mask.

## OTel Metrics

All handlers automatically emit four metrics via the `BHASW` static instrumentation:

| Metric                      | Type      | Description                                     |
| --------------------------- | --------- | ----------------------------------------------- |
| `d2.handler.duration`       | Histogram | Execution duration in milliseconds              |
| `d2.handler.invocations`    | Counter   | Total handler invocations                       |
| `d2.handler.failures`       | Counter   | Non-success results (D2Result.Success == false) |
| `d2.handler.exceptions`     | Counter   | Unhandled exceptions caught by BaseHandler      |

All metrics are tagged with `handler.name` for per-handler breakdowns.
