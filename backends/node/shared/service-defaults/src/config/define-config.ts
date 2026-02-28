/**
 * Typed config system for Node.js services.
 *
 * Provides a declarative schema where each field is either required (crash if
 * missing), optional with default (always has a value), or optional (may be
 * undefined). Mirrors .NET's Options pattern.
 *
 * @example
 * ```ts
 * const config = defineConfig("auth-service", {
 *   databaseUrl: requiredParsed(parsePostgresUrl,
 *     "ConnectionStrings__d2-services-auth", "ConnectionStrings__d2_services_auth"),
 *   port: defaultInt(5100, "PORT"),
 *   grpcPort: optionalInt("AUTH_GRPC_PORT"),
 * });
 * ```
 */

import { parsePositiveInt } from "./parse-positive-int.js";

// ---------------------------------------------------------------------------
// FieldDescriptor — branded type for compile-time inference
// ---------------------------------------------------------------------------

/** A config field descriptor that resolves to a value of type T. */
export interface FieldDescriptor<T> {
  /** Phantom type — never read at runtime. Enables type inference in defineConfig. */
  readonly __type: T;
  /** Resolves the field value, pushing to errors[] if required and missing. */
  readonly _resolve: (errors: string[]) => T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the first non-empty env var from a list of keys. */
function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

/** Format env key names for error messages. */
function formatKeys(keys: string[]): string {
  return keys.join(" | ");
}

// ---------------------------------------------------------------------------
// Field Descriptor Factories
// ---------------------------------------------------------------------------

/**
 * Required string field. Crashes at startup if missing or empty.
 * When multiple env keys are provided, the first non-empty match wins.
 */
export function requiredString(...envKeys: string[]): FieldDescriptor<string> {
  return {
    __type: undefined as unknown as string,
    _resolve(errors) {
      const value = readEnv(...envKeys);
      if (value === undefined) {
        errors.push(formatKeys(envKeys));
        return "" as string;
      }
      return value;
    },
  };
}

/**
 * Optional string field. Returns undefined if missing.
 * When multiple env keys are provided, the first non-empty match wins.
 */
export function optionalString(...envKeys: string[]): FieldDescriptor<string | undefined> {
  return {
    __type: undefined as string | undefined,
    _resolve() {
      return readEnv(...envKeys);
    },
  };
}

/**
 * String field with a default value. Returns the default if missing.
 * When multiple env keys are provided, the first non-empty match wins.
 */
export function defaultString(
  defaultValue: string,
  ...envKeys: string[]
): FieldDescriptor<string> {
  return {
    __type: undefined as unknown as string,
    _resolve() {
      return readEnv(...envKeys) ?? defaultValue;
    },
  };
}

/**
 * Required field with a custom parser. Crashes if the raw env var is missing
 * or if the parser throws / returns a falsy value.
 * When multiple env keys are provided, the first non-empty match wins.
 */
export function requiredParsed<R>(
  parse: (value: string) => R,
  ...envKeys: string[]
): FieldDescriptor<R> {
  return {
    __type: undefined as unknown as R,
    _resolve(errors) {
      const raw = readEnv(...envKeys);
      if (raw === undefined) {
        errors.push(formatKeys(envKeys));
        return undefined as unknown as R;
      }
      const parsed = parse(raw);
      // Parsers like parsePostgresUrl return "" on invalid input
      if (parsed === "" || parsed === undefined || parsed === null) {
        errors.push(formatKeys(envKeys));
        return undefined as unknown as R;
      }
      return parsed;
    },
  };
}

/**
 * Optional field with a custom parser. Returns undefined if the raw env var is
 * missing. If present, applies the parser; returns undefined if the parser
 * returns a falsy value (e.g. "" for invalid input).
 * When multiple env keys are provided, the first non-empty match wins.
 */
export function optionalParsed<R>(
  parse: (value: string) => R,
  ...envKeys: string[]
): FieldDescriptor<R | undefined> {
  return {
    __type: undefined as R | undefined,
    _resolve() {
      const raw = readEnv(...envKeys);
      if (raw === undefined) return undefined;
      const parsed = parse(raw);
      if (parsed === "" || parsed === undefined || parsed === null) return undefined;
      return parsed;
    },
  };
}

/**
 * Required positive integer field. Crashes if missing or not a valid positive int.
 * When multiple env keys are provided, the first non-empty match wins.
 */
export function requiredInt(...envKeys: string[]): FieldDescriptor<number> {
  return {
    __type: undefined as unknown as number,
    _resolve(errors) {
      const raw = readEnv(...envKeys);
      if (raw === undefined) {
        errors.push(formatKeys(envKeys));
        return 0;
      }
      return parsePositiveInt(raw, formatKeys(envKeys));
    },
  };
}

/**
 * Optional positive integer field. Returns undefined if missing, parses if present.
 * When multiple env keys are provided, the first non-empty match wins.
 */
export function optionalInt(...envKeys: string[]): FieldDescriptor<number | undefined> {
  return {
    __type: undefined as number | undefined,
    _resolve() {
      const raw = readEnv(...envKeys);
      if (raw === undefined) return undefined;
      return parsePositiveInt(raw, formatKeys(envKeys));
    },
  };
}

/**
 * Integer field with a default value. Returns the default if missing.
 * When multiple env keys are provided, the first non-empty match wins.
 */
export function defaultInt(defaultValue: number, ...envKeys: string[]): FieldDescriptor<number> {
  return {
    __type: undefined as unknown as number,
    _resolve() {
      const raw = readEnv(...envKeys);
      if (raw === undefined) return defaultValue;
      return parsePositiveInt(raw, formatKeys(envKeys));
    },
  };
}

/**
 * Reads indexed environment variables into an array.
 * Reads `${prefix}__0`, `${prefix}__1`, ... until a gap is found.
 * Matches .NET's indexed-array binding convention.
 */
export function envArray(prefix: string): FieldDescriptor<string[]> {
  return {
    __type: undefined as unknown as string[],
    _resolve() {
      const result: string[] = [];
      for (let i = 0; ; i++) {
        const value = process.env[`${prefix}__${i}`];
        if (value === undefined) break;
        result.push(value);
      }
      return result;
    },
  };
}

/**
 * Optional section that mirrors .NET's `Configure<T>(section)`.
 *
 * Maps camelCase default keys to `PREFIX__UPPERCASEKEY` env vars:
 * - `signInEventRetentionDays` → `PREFIX__SIGNINEVENTRETENTIONDAYS`
 *
 * Behavior:
 * - If ZERO env vars in the section exist → returns undefined
 * - If ANY env var exists → starts with defaults, overrides matching fields, returns full object
 * - All values must be positive integers
 */
export function optionalSection<T extends { [K in keyof T]: number }>(
  prefix: string,
  defaults: T,
): FieldDescriptor<T | undefined> {
  return {
    __type: undefined as T | undefined,
    _resolve() {
      const keys = Object.keys(defaults);
      let anyFound = false;
      const result = { ...defaults };

      for (const key of keys) {
        const envKey = `${prefix}__${key.toUpperCase()}`;
        const raw = process.env[envKey];
        if (raw !== undefined && raw !== "") {
          anyFound = true;
          (result as Record<string, number>)[key] = parsePositiveInt(raw, envKey);
        }
      }

      return anyFound ? result : undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// defineConfig — main entry point
// ---------------------------------------------------------------------------

/** Infers the resolved type of a config schema. */
type InferConfig<S> = { [K in keyof S]: S[K] extends FieldDescriptor<infer T> ? T : never };

/** Error thrown when required config fields are missing. */
export class ConfigError extends Error {
  constructor(serviceName: string, missing: string[]) {
    super(`${serviceName}: missing required config — ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

/**
 * Defines and resolves a typed config object from environment variables.
 *
 * 1. Iterates all fields, reads env vars (first match wins for multi-key fields)
 * 2. Collects ALL missing required fields
 * 3. Throws ONE aggregate ConfigError listing every missing field
 * 4. Returns a frozen, fully-typed config object
 */
export function defineConfig<S extends Record<string, FieldDescriptor<unknown>>>(
  serviceName: string,
  schema: S,
): Readonly<InferConfig<S>> {
  const errors: string[] = [];
  const result: Record<string, unknown> = {};

  for (const [key, descriptor] of Object.entries(schema)) {
    result[key] = descriptor._resolve(errors);
  }

  if (errors.length > 0) {
    throw new ConfigError(serviceName, errors);
  }

  return Object.freeze(result) as Readonly<InferConfig<S>>;
}
