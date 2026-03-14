import { timingSafeEqual } from "node:crypto";
import { D2Result } from "@d2/result";
import { TK } from "@d2/i18n";

/**
 * Validates an API key against a set of valid keys using constant-time comparison.
 *
 * @param apiKey - The API key from the request header
 * @param validKeys - List of valid service API keys
 * @returns null if valid, D2Result error if invalid
 */
export function validateServiceKey(apiKey: string, validKeys: string[]): D2Result | null {
  if (validKeys.length === 0) {
    return D2Result.unauthorized({ messages: [TK.common.errors.UNAUTHORIZED] });
  }

  const apiKeyBuffer = Buffer.from(apiKey, "utf8");
  let matched = false;

  for (const validKey of validKeys) {
    const validKeyBuffer = Buffer.from(validKey, "utf8");

    // Only compare if same length (timingSafeEqual requires equal-length buffers).
    // Always iterate ALL keys to prevent timing leaks on key count.
    if (apiKeyBuffer.length === validKeyBuffer.length) {
      if (timingSafeEqual(apiKeyBuffer, validKeyBuffer)) {
        matched = true;
      }
    }
  }

  if (!matched) {
    return D2Result.unauthorized({ messages: [TK.common.errors.UNAUTHORIZED] });
  }

  return null;
}
