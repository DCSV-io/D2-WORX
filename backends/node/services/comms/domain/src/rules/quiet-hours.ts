import type { QuietHoursResult } from "../value-objects/resolved-channels.js";

/**
 * Checks whether the current time falls within a quiet hours window.
 *
 * Uses the Intl API to convert UTC "now" to the user's local timezone,
 * then checks against the start/end window. Handles overnight windows
 * (e.g., 22:00→07:00) where end < start.
 *
 * Returns the UTC timestamp when the quiet hours window ends so the
 * app layer can schedule delayed delivery.
 *
 * @param start - Quiet hours start in "HH:MM" format (user's local time)
 * @param end - Quiet hours end in "HH:MM" format (user's local time)
 * @param tz - IANA timezone identifier (e.g., "America/New_York")
 * @param now - Current UTC time (defaults to Date.now for testability)
 */
export function isInQuietHours(
  start: string,
  end: string,
  tz: string,
  now?: Date,
): QuietHoursResult {
  const currentUtc = now ?? new Date();

  // Parse HH:MM
  const [startHour, startMinute] = start.split(":").map(Number) as [number, number];
  const [endHour, endMinute] = end.split(":").map(Number) as [number, number];

  // Convert current UTC time to user's local time using Intl
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(currentUtc);
  const localHour = Number(parts.find((p) => p.type === "hour")!.value);
  const localMinute = Number(parts.find((p) => p.type === "minute")!.value);

  // Convert to minutes since midnight for easy comparison
  const nowMinutes = localHour * 60 + localMinute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  let inWindow: boolean;
  let minutesUntilEnd: number;

  if (startMinutes <= endMinutes) {
    // Same-day window (e.g., 08:00→17:00)
    inWindow = nowMinutes >= startMinutes && nowMinutes < endMinutes;
    minutesUntilEnd = endMinutes - nowMinutes;
  } else {
    // Overnight window (e.g., 22:00→07:00)
    inWindow = nowMinutes >= startMinutes || nowMinutes < endMinutes;
    if (nowMinutes >= startMinutes) {
      // Before midnight: minutes until midnight + end minutes
      minutesUntilEnd = (24 * 60 - nowMinutes) + endMinutes;
    } else {
      // After midnight: minutes until end
      minutesUntilEnd = endMinutes - nowMinutes;
    }
  }

  if (!inWindow) {
    return { inQuietHours: false, quietHoursEndUtc: null };
  }

  // Compute UTC time when quiet hours end
  const quietHoursEndUtc = new Date(currentUtc.getTime() + minutesUntilEnd * 60 * 1000);

  return { inQuietHours: true, quietHoursEndUtc };
}
