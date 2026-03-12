import type { IHandler } from "@d2/handler";

export interface RunEmulationConsentCleanupInput {}

export interface RunEmulationConsentCleanupOutput {
  readonly rowsAffected: number;
  readonly lockAcquired: boolean;
  readonly durationMs: number;
}

/** Handler for cleaning up expired emulation consents (scheduled job). */
export interface IRunEmulationConsentCleanupHandler extends IHandler<
  RunEmulationConsentCleanupInput,
  RunEmulationConsentCleanupOutput
> {}
