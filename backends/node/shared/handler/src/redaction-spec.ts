/**
 * Declares a handler's intrinsic data redaction posture.
 * Defined alongside handler interface type aliases, wired up by implementations.
 */
export interface RedactionSpec {
  /** Input field names to mask with "[REDACTED]" before logging. Shallow (top-level keys only). */
  readonly inputFields?: readonly string[];
  /** Output field names to mask with "[REDACTED]" before logging. Shallow (top-level keys only). */
  readonly outputFields?: readonly string[];
  /** Suppress input logging entirely (when input contains un-annotatable types like proto messages). */
  readonly suppressInput?: boolean;
  /** Suppress output logging entirely (when output contains un-annotatable types like proto messages). */
  readonly suppressOutput?: boolean;
}
