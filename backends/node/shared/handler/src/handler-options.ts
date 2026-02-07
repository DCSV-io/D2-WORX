/**
 * Options to customize the behavior of a handler.
 * Mirrors D2.Shared.Handler.HandlerOptions in .NET.
 */
export interface HandlerOptions {
  /** Suppress time-related warnings during handling. Default: false. */
  suppressTimeWarnings?: boolean;
  /** Log the input provided to the handler as debug. Default: true. */
  logInput?: boolean;
  /** Log the output produced by the handler as debug. Default: true. */
  logOutput?: boolean;
  /** Threshold in ms for logging a warning. Default: 100. */
  warningThresholdMs?: number;
  /** Threshold in ms for logging a critical warning. Default: 500. */
  criticalThresholdMs?: number;
}

/** Default handler options matching .NET defaults. */
export const DEFAULT_HANDLER_OPTIONS: Required<HandlerOptions> = {
  suppressTimeWarnings: false,
  logInput: true,
  logOutput: true,
  warningThresholdMs: 100,
  criticalThresholdMs: 500,
};
