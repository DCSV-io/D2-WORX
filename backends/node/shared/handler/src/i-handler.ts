import type { D2Result } from "@d2/result";
import type { HandlerOptions } from "./handler-options.js";

/**
 * Handler interface that processes an input and produces an output wrapped in D2Result.
 * Mirrors D2.Shared.Handler.IHandler<TInput, TOutput> in .NET.
 */
export interface IHandler<TInput, TOutput> {
  handleAsync(input: TInput, options?: HandlerOptions): Promise<D2Result<TOutput | undefined>>;
}
