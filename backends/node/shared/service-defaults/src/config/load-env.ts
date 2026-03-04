/**
 * Minimal .env.local loader — mirrors .NET D2Env.Load().
 *
 * Walks up from cwd looking for `.env.local` (then `.env`), parses it, and
 * sets vars via `process.env[key] ??= value` (never overwrites existing).
 * This means Aspire-injected vars always win, and `.env.local` fills the gaps.
 *
 * Zero external dependencies — just `node:fs` and `node:path`.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const FILE_NAMES = [".env.local", ".env"];
const MAX_DEPTH = 12;

let loaded = false;

/**
 * Loads environment variables from the nearest `.env.local` or `.env` file.
 * Safe to call multiple times (no-op after first load).
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const filePath = findEnvFile();
  if (!filePath) return;

  const content = readFileSync(filePath, "utf-8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip empty lines and comments.
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    // Never overwrite existing (Aspire-injected vars win).
    process.env[key] ??= value;
  }
}

function findEnvFile(): string | undefined {
  let dir = resolve(process.cwd());
  for (let i = 0; i < MAX_DEPTH; i++) {
    for (const name of FILE_NAMES) {
      const candidate = resolve(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return undefined;
}
