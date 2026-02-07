import type { D2Result } from "@d2/result";
import type { HandlerOptions } from "./handler-options.js";
import type { RedactionSpec } from "./redaction-spec.js";

/**
 * Handler interface that processes an input and produces an output wrapped in D2Result.
 * Mirrors D2.Shared.Handler.IHandler<TInput, TOutput> in .NET.
 */
export interface IHandler<TInput, TOutput> {
  handleAsync(input: TInput, options?: HandlerOptions): Promise<D2Result<TOutput | undefined>>;
  /** Redaction posture for this handler's I/O logging. */
  readonly redaction?: RedactionSpec;
}
