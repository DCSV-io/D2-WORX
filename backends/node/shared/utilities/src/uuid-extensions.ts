/**
 * UUID utility functions.
 * Mirrors D2.Shared.Utilities.Extensions.GuidExtensions in .NET.
 */

import { v7 as uuidv7 } from "uuid";

/** The all-zeros UUID (equivalent to Guid.Empty in .NET). */
export const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Generates a new UUIDv7 (time-ordered, sortable).
 * Mirrors `Guid.CreateVersion7()` in .NET 10.
 */
export function generateUuidV7(): string {
  return uuidv7();
}

/**
 * Checks if a UUID string is "truthy" (not null/undefined/empty and not the all-zeros UUID).
 */
export function uuidTruthy(uuid: string | null | undefined): uuid is string {
  return uuid != null && uuid.length > 0 && uuid !== EMPTY_UUID;
}

/**
 * Checks if a UUID string is "falsey" (null, undefined, empty, or the all-zeros UUID).
 */
export function uuidFalsey(uuid: string | null | undefined): boolean {
  return !uuidTruthy(uuid);
}
