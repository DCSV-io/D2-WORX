# @d2/logging

Logging abstraction with Pino implementation. Auto-instrumented by OpenTelemetry when `@d2/service-defaults` is initialized. Layer 0 — depends only on `pino`.

## Files

| File Name                                  | Description                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| [i-logger.ts](src/i-logger.ts)             | `ILogger` interface (`debug`, `info`, `warn`, `error`, `fatal`, `child`).     |
| [logger-options.ts](src/logger-options.ts) | `LoggerOptions` type for logger configuration (level, name, pretty printing). |
| [create-logger.ts](src/create-logger.ts)   | Factory function `createLogger()` to create configured logger instances.      |
| [pino-logger.ts](src/pino-logger.ts)       | `PinoLogger` class implementing `ILogger` via Pino.                           |
| [index.ts](src/index.ts)                   | Barrel re-export of `ILogger`, `LogLevel`, `createLogger`, `PinoLogger`.      |

## Usage

```typescript
import { createLogger } from "@d2/logging";

const logger = createLogger({ name: "my-service", level: "info" });
logger.info("Server started");
logger.child({ requestId: "abc" }).debug("Processing request");
```

## Design

`ILogger` is a platform-agnostic interface that decouples business logic from the logging implementation. Handlers receive `ILogger` via `IHandlerContext`, same as .NET handlers receive `ILogger` via `IHandlerContext`.

When `setupTelemetry()` from `@d2/service-defaults` is called, Pino logs are automatically instrumented by the OpenTelemetry Pino instrumentation — no additional configuration needed.

## .NET Equivalent

`Microsoft.Extensions.Logging.ILogger` — injected via `IHandlerContext.Logger`.
