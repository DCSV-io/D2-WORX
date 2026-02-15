# @d2/handler

BaseHandler pattern with automatic OTel tracing, metrics, and structured logging. Mirrors `D2.Shared.Handler` in .NET. Layer 1.

## Files

| File Name                                                      | Description                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [base-handler.ts](src/base-handler.ts)                         | `BaseHandler` abstract class with OTel spans, 4 metrics, input/output redaction. |
| [i-handler.ts](src/i-handler.ts)                               | `IHandler<TInput, TOutput>` interface with optional `redaction` property.        |
| [i-handler-context.ts](src/i-handler-context.ts)               | `IHandlerContext` interface bundling `IRequestContext` + `ILogger`.              |
| [handler-context.ts](src/handler-context.ts)                   | `HandlerContext` implementation of `IHandlerContext`.                            |
| [i-request-context.ts](src/i-request-context.ts)               | `IRequestContext` interface (traceId, userId, agentOrgId, targetOrgId).          |
| [handler-options.ts](src/handler-options.ts)                   | `HandlerOptions` type + `DEFAULT_HANDLER_OPTIONS` constant.                      |
| [redaction-spec.ts](src/redaction-spec.ts)                     | `RedactionSpec` type for declaring handler input/output redaction posture.       |
| [validators.ts](src/validators.ts)                             | Shared Zod refinements (`zodGuid`, `zodHashId`, `zodIpAddress`, `zodEmail`, `zodPhoneE164`, `zodNonEmptyString`, `zodNonEmptyArray`, `zodAllowedContextKey`) + standalone validators. |
| [org-type.ts](src/org-type.ts)                                 | `OrgType` enum (Admin, Support, Affiliate, Customer, CustomerClient).            |
| [index.ts](src/index.ts)                                       | Barrel re-export of all types, interfaces, and classes.                          |

---

## HandlerOptions

Controls handler logging and timing behavior. Can be provided per-call or as a handler default.

```typescript
interface HandlerOptions {
  logInput: boolean; // Log input at debug level (default: true)
  logOutput: boolean; // Log output at debug level (default: true)
  suppressTimeWarnings: boolean; // Skip elapsed-time warning/critical levels (default: false)
  warningThresholdMs: number; // Elapsed time for warning level (default: 100)
  criticalThresholdMs: number; // Elapsed time for critical level (default: 500)
}
```

## RedactionSpec

Declares a handler's intrinsic data redaction posture. Defined alongside handler interfaces, wired by implementations.

```typescript
interface RedactionSpec {
  readonly inputFields?: readonly string[]; // Top-level input fields to mask with "[REDACTED]"
  readonly outputFields?: readonly string[]; // Top-level output fields to mask with "[REDACTED]"
  readonly suppressInput?: boolean; // Skip input logging entirely
  readonly suppressOutput?: boolean; // Skip output logging entirely
}
```

**Interaction rules:**

- `HandlerOptions.logInput=false` OR `RedactionSpec.suppressInput=true` → input not logged
- Field masking only applies when logging is not suppressed
- Suppression wins over field masking when both are set

## OTel Metrics

All handlers automatically emit four metrics:

| Metric                   | Type      | Description                                     |
| ------------------------ | --------- | ----------------------------------------------- |
| `d2.handler.duration`    | Histogram | Execution duration in milliseconds              |
| `d2.handler.invocations` | Counter   | Total handler invocations                       |
| `d2.handler.failures`    | Counter   | Non-success results (D2Result.success == false) |
| `d2.handler.exceptions`  | Counter   | Unhandled exceptions caught by BaseHandler      |

All metrics are tagged with `handler.name` for per-handler breakdowns.

## .NET Equivalent

`D2.Shared.Handler` — `BaseHandler<THandler, TInput, TOutput>` with `DefaultOptions` virtual property, `HandlerOptions` record, OTel `ActivitySource` + metrics via `BHASW`.
