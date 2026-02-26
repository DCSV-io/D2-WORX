import {
  trace,
  metrics,
  SpanStatusCode,
  type Tracer,
  type Meter,
  type Counter,
  type Histogram,
} from "@opentelemetry/api";
import { D2Result, type InputError } from "@d2/result";
import type { ZodType, ZodError } from "zod";
import type { IHandlerContext } from "./i-handler-context.js";
import type { IHandler } from "./i-handler.js";
import { DEFAULT_HANDLER_OPTIONS, type HandlerOptions } from "./handler-options.js";
import type { RedactionSpec } from "./redaction-spec.js";

/** OTel instruments shared across all handler instances. */
interface HandlerInstruments {
  duration: Histogram;
  invocations: Counter;
  failures: Counter;
  exceptions: Counter;
}

/**
 * Base handler providing automatic logging, tracing, and metrics.
 * Mirrors D2.Shared.Handler.BaseHandler<THandler, TInput, TOutput> in .NET.
 *
 * Subclasses implement `executeAsync()` with the handler's core logic.
 */
export abstract class BaseHandler<TInput, TOutput> implements IHandler<TInput, TOutput> {
  // Static OTel instruments (shared across all handler instances, lazy-initialized)
  private static tracer: Tracer;
  private static meter: Meter;
  private static instruments: HandlerInstruments | undefined;

  protected readonly context: IHandlerContext;

  protected get traceId(): string | undefined {
    return this.context.request.traceId;
  }

  /** Override to declare this handler's redaction posture. */
  get redaction(): RedactionSpec | undefined {
    return undefined;
  }

  protected constructor(context: IHandlerContext) {
    this.context = context;

    // Lazy-init static OTel instruments on first instance creation
    if (!BaseHandler.instruments) {
      BaseHandler.tracer = trace.getTracer("d2.shared.handler");
      BaseHandler.meter = metrics.getMeter("d2.shared.handler");
      BaseHandler.instruments = {
        duration: BaseHandler.meter.createHistogram("d2.handler.duration", {
          description: "Handler execution duration in milliseconds",
          unit: "ms",
        }),
        invocations: BaseHandler.meter.createCounter("d2.handler.invocations", {
          description: "Total number of handler invocations",
        }),
        failures: BaseHandler.meter.createCounter("d2.handler.failures", {
          description: "Total number of handler failures (non-success results)",
        }),
        exceptions: BaseHandler.meter.createCounter("d2.handler.exceptions", {
          description: "Total number of unhandled exceptions in handlers",
        }),
      };
    }
  }

  async handleAsync(
    input: TInput,
    options?: HandlerOptions,
  ): Promise<D2Result<TOutput | undefined>> {
    const handlerName = this.constructor.name;
    const opts = { ...DEFAULT_HANDLER_OPTIONS, ...options };
    const attrs = { "handler.name": handlerName };

    // Record invocation
    BaseHandler.instruments!.invocations.add(1, attrs);

    return BaseHandler.tracer.startActiveSpan(handlerName, async (span) => {
      // Set span tags (mirrors .NET activity tags exactly).
      // Note: user.id, agent.org.id, target.org.id are PII — only set when
      // present to avoid leaking empty-string placeholders to external
      // observability backends. Production deployments should configure
      // OTel exporters to redact or filter these attributes as needed.
      span.setAttribute("handler.type", handlerName);
      span.setAttribute("trace.id", this.context.request.traceId ?? "");
      if (this.context.request.userId) span.setAttribute("user.id", this.context.request.userId);
      if (this.context.request.agentOrgId) span.setAttribute("agent.org.id", this.context.request.agentOrgId);
      if (this.context.request.targetOrgId) span.setAttribute("target.org.id", this.context.request.targetOrgId);

      const startTime = performance.now();

      try {
        // Log execution start
        this.context.logger.info(
          `Executing handler ${handlerName}. TraceId: ${this.context.request.traceId}.`,
        );

        // Log input as debug if enabled (respecting redaction)
        if (opts.logInput && !this.redaction?.suppressInput) {
          const inputToLog = this.redaction?.inputFields?.length
            ? this.redactForLogging(input, this.redaction.inputFields)
            : input;
          this.context.logger.debug(
            `Handler ${handlerName} received input: ${BaseHandler.safeStringify(inputToLog)}. TraceId: ${this.context.request.traceId}.`,
          );
        }

        // Execute the handler's logic
        const rawResult = await this.executeAsync(input);

        // Auto-inject ambient traceId into result if handler didn't set it.
        // This eliminates the need for every handler to pass `traceId: this.traceId`.
        const result = this._injectTraceId(rawResult);

        // Stop timing
        const elapsedMs = performance.now() - startTime;

        // Log output as debug if enabled (respecting redaction)
        if (opts.logOutput && !this.redaction?.suppressOutput) {
          const resultToLog =
            this.redaction?.outputFields?.length && result.data
              ? { ...result, data: this.redactForLogging(result.data, this.redaction.outputFields) }
              : result;
          this.context.logger.debug(
            `Handler ${handlerName} produced result: ${BaseHandler.safeStringify(resultToLog)}. TraceId: ${this.context.request.traceId}.`,
          );
        }

        // Set result metadata on span
        span.setAttribute("handler.success", result.success);
        span.setAttribute("handler.status.code", result.statusCode);
        span.setAttribute("handler.error.code", result.errorCode ?? "");
        span.setAttribute("handler.elapsed.ms", elapsedMs);
        span.setStatus(
          result.success ? { code: SpanStatusCode.OK } : { code: SpanStatusCode.ERROR },
        );

        // Record duration metric
        BaseHandler.instruments!.duration.record(elapsedMs, attrs);

        // Record failure metric if not successful
        if (!result.success) {
          BaseHandler.instruments!.failures.add(1, attrs);
        }

        // Determine log level based on success and elapsed time
        const status = result.success ? "successfully" : "unsuccessfully";
        const completionMsg = `Executed handler ${handlerName} ${status} in ${elapsedMs.toFixed(0)}ms. TraceId: ${this.context.request.traceId}.`;

        if (opts.suppressTimeWarnings) {
          if (result.success) {
            this.context.logger.info(completionMsg);
          } else {
            this.context.logger.warn(completionMsg);
          }
        } else if (result.success && elapsedMs < opts.warningThresholdMs) {
          this.context.logger.info(completionMsg);
        } else if (elapsedMs < opts.criticalThresholdMs) {
          this.context.logger.warn(completionMsg);
        } else {
          this.context.logger.error(completionMsg);
        }

        span.end();
        return result;
      } catch (ex) {
        // Stop timing
        const elapsedMs = performance.now() - startTime;

        // Create unhandled exception result
        const errorResult = D2Result.unhandledException<TOutput | undefined>({
          traceId: this.context.request.traceId,
        });

        // Set exception metadata on span
        span.setAttribute("handler.success", errorResult.success);
        span.setAttribute("handler.status.code", errorResult.statusCode);
        span.setAttribute("handler.error.code", errorResult.errorCode ?? "");
        span.setAttribute("handler.elapsed.ms", elapsedMs);
        span.setStatus({ code: SpanStatusCode.ERROR });
        if (ex instanceof Error) {
          span.recordException(ex);
        }

        // Record metrics
        BaseHandler.instruments!.duration.record(elapsedMs, attrs);
        BaseHandler.instruments!.exceptions.add(1, attrs);

        // Log the unhandled exception
        this.context.logger.error(
          `Handler ${handlerName} encountered an unhandled exception after ${elapsedMs.toFixed(0)}ms. TraceId: ${this.context.request.traceId}.`,
        );

        span.end();
        return errorResult;
      }
    });
  }

  /**
   * Executes the core logic of the handler.
   * Subclasses must implement this method.
   */
  protected abstract executeAsync(input: TInput): Promise<D2Result<TOutput | undefined>>;

  /**
   * Validates the input against a Zod schema.
   * Returns ok on success, validationFailed with inputErrors on failure.
   */
  protected validateInput(schema: ZodType<TInput>, input: TInput): D2Result<void> {
    const result = schema.safeParse(input);
    if (result.success) {
      return D2Result.ok();
    }

    const inputErrors: InputError[] = (result as { error: ZodError }).error.issues.map((issue) => [
      issue.path.join("."),
      issue.message,
    ]);
    return D2Result.validationFailed({ inputErrors });
  }

  /**
   * Injects the ambient traceId into a result if the handler didn't set one.
   * This enables handlers to omit `traceId: this.traceId` from every D2Result call.
   */
  private _injectTraceId<T>(result: D2Result<T>): D2Result<T> {
    if (result.traceId || !this.traceId) return result;
    return new D2Result({
      success: result.success,
      data: result.data,
      messages: [...result.messages],
      inputErrors: result.inputErrors.map((ie) => [...ie]),
      statusCode: result.statusCode,
      errorCode: result.errorCode,
      traceId: this.traceId,
    });
  }

  /** Safely serializes a value to JSON with size limiting and circular reference protection. */
  private static safeStringify(value: unknown, maxLength = 10_000): string {
    try {
      const json = JSON.stringify(value);
      if (json.length > maxLength) {
        return json.slice(0, maxLength) + `...[truncated, ${json.length} total chars]`;
      }
      return json;
    } catch {
      return "[unserializable]";
    }
  }

  /** Replaces specified top-level fields with "[REDACTED]" for logging. */
  private redactForLogging(obj: unknown, fields: readonly string[]): unknown {
    if (!fields.length || obj === null || obj === undefined || typeof obj !== "object") {
      return obj;
    }
    const clone: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
    for (const field of fields) {
      if (field in clone) {
        clone[field] = "[REDACTED]";
      }
    }
    return clone;
  }
}
