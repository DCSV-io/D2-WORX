import type { IHandler } from "@d2/handler";

export interface PurgeExpiredEmulationConsentsInput extends Record<string, never> {}

export interface PurgeExpiredEmulationConsentsOutput {
  readonly rowsAffected: number;
}

export type IPurgeExpiredEmulationConsentsHandler = IHandler<
  PurgeExpiredEmulationConsentsInput,
  PurgeExpiredEmulationConsentsOutput
>;
