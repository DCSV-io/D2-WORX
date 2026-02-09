import { z } from "zod";
import net from "node:net";

// ---------------------------------------------------------------------------
// Standalone validation functions
// ---------------------------------------------------------------------------

/** Returns true if the string is a valid IPv4 or IPv6 address. */
export const isValidIpAddress = (ip: string): boolean =>
  net.isIPv4(ip) || net.isIPv6(ip);

/** Returns true if the string is a valid 64-character hex SHA-256 hash ID. */
export const isValidHashId = (id: string): boolean => /^[a-f0-9]{64}$/i.test(id);

/** Returns true if the string is a valid UUID (any version). */
export const isValidGuid = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Returns true if the string passes basic email format validation. */
export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/** Returns true if the string is 7-15 digits (E.164-compatible). */
export const isValidPhoneE164 = (phone: string): boolean => /^\d{7,15}$/.test(phone);

// ---------------------------------------------------------------------------
// Zod refinements for reuse in schemas
// ---------------------------------------------------------------------------

/** Zod schema for a 64-character hex SHA-256 hash ID. */
export const zodHashId = z
  .string()
  .length(64, "Must be exactly 64 characters")
  .regex(/^[a-f0-9]+$/i, "Must be a valid hex string");

/** Zod schema for a valid IPv4 or IPv6 address. */
export const zodIpAddress = z.string().refine(isValidIpAddress, "Must be a valid IPv4 or IPv6 address");

/** Zod schema for a valid UUID. */
export const zodGuid = z.string().uuid("Must be a valid UUID");

/** Zod schema for a valid email address. */
export const zodEmail = z.string().refine(isValidEmail, "Must be a valid email address");

/** Zod schema for a phone number with 7-15 digits (E.164). */
export const zodPhoneE164 = z.string().regex(/^\d{7,15}$/, "Must be 7-15 digits (E.164)");

/** Creates a Zod schema for a non-empty string with max length. */
export const zodNonEmptyString = (maxLen: number) => z.string().min(1, "Must not be empty").max(maxLen);

/** Creates a Zod schema for a non-empty array of items matching the given schema. */
export const zodNonEmptyArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).min(1, "Must not be empty");
