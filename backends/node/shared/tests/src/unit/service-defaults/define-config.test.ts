import { describe, it, expect, afterEach } from "vitest";
import {
  defineConfig,
  ConfigError,
  requiredString,
  optionalString,
  defaultString,
  requiredParsed,
  optionalParsed,
  requiredInt,
  optionalInt,
  defaultInt,
  envArray,
  optionalSection,
  parsePositiveInt,
} from "@d2/service-defaults/config";

// ---------------------------------------------------------------------------
// Env cleanup helper
// ---------------------------------------------------------------------------

/** Track every key we set so afterEach can clean up reliably. */
const keysSet: string[] = [];

function setEnv(key: string, value: string): void {
  process.env[key] = value;
  keysSet.push(key);
}

afterEach(() => {
  for (const key of keysSet) {
    delete process.env[key];
  }
  keysSet.length = 0;
});

// ---------------------------------------------------------------------------
// parsePositiveInt
// ---------------------------------------------------------------------------

describe("parsePositiveInt", () => {
  it("parses a valid positive integer", () => {
    expect(parsePositiveInt("42", "test")).toBe(42);
  });

  it("parses integer 1 (edge case)", () => {
    expect(parsePositiveInt("1", "test")).toBe(1);
  });

  it("throws for zero", () => {
    expect(() => parsePositiveInt("0", "PORT")).toThrow(
      'Invalid config "PORT": "0" — must be a positive integer',
    );
  });

  it("throws for negative integers", () => {
    expect(() => parsePositiveInt("-5", "PORT")).toThrow("must be a positive integer");
  });

  it("throws for non-numeric strings", () => {
    expect(() => parsePositiveInt("abc", "PORT")).toThrow("must be a positive integer");
  });

  it("truncates floating point to integer (parseInt behavior)", () => {
    expect(parsePositiveInt("3.14", "PORT")).toBe(3);
  });

  it("throws for empty string", () => {
    expect(() => parsePositiveInt("", "PORT")).toThrow("must be a positive integer");
  });
});

// ---------------------------------------------------------------------------
// requiredString
// ---------------------------------------------------------------------------

describe("requiredString", () => {
  it("returns the value when the env var is present", () => {
    setEnv("TEST_REQ_STR", "hello");
    const config = defineConfig("test", { value: requiredString("TEST_REQ_STR") });
    expect(config.value).toBe("hello");
  });

  it("throws ConfigError when the env var is missing", () => {
    expect(() => defineConfig("test-svc", { value: requiredString("TEST_MISSING") })).toThrow(
      ConfigError,
    );
    expect(() => defineConfig("test-svc", { value: requiredString("TEST_MISSING") })).toThrow(
      "test-svc: missing required config — TEST_MISSING",
    );
  });

  it("treats empty string as missing", () => {
    setEnv("TEST_REQ_EMPTY", "");
    expect(() => defineConfig("test", { value: requiredString("TEST_REQ_EMPTY") })).toThrow(
      ConfigError,
    );
  });
});

// ---------------------------------------------------------------------------
// requiredParsed
// ---------------------------------------------------------------------------

describe("requiredParsed", () => {
  it("returns the parsed value when present", () => {
    setEnv("TEST_PARSED", "postgresql://user:pass@host:5432/db");
    const parse = (v: string) => v.toUpperCase();
    const config = defineConfig("test", { value: requiredParsed(parse, "TEST_PARSED") });
    expect(config.value).toBe("POSTGRESQL://USER:PASS@HOST:5432/DB");
  });

  it("throws ConfigError when missing", () => {
    const parse = (v: string) => v;
    expect(() => defineConfig("test", { value: requiredParsed(parse, "TEST_NOT_HERE") })).toThrow(
      ConfigError,
    );
  });

  it("throws ConfigError when parser returns empty string (invalid input)", () => {
    setEnv("TEST_PARSED_EMPTY", "not-a-url");
    // Simulate parsePostgresUrl behavior: returns "" on invalid input
    const parse = (v: string) => (v.startsWith("postgresql://") ? v : "");
    expect(() =>
      defineConfig("test", { value: requiredParsed(parse, "TEST_PARSED_EMPTY") }),
    ).toThrow(ConfigError);
  });

  it("propagates parser exceptions", () => {
    setEnv("TEST_PARSED_THROW", "bad");
    const parse = (_: string) => {
      throw new Error("parse failed");
    };
    expect(() =>
      defineConfig("test", { value: requiredParsed(parse, "TEST_PARSED_THROW") }),
    ).toThrow("parse failed");
  });
});

// ---------------------------------------------------------------------------
// optionalParsed
// ---------------------------------------------------------------------------

describe("optionalParsed", () => {
  it("returns the parsed value when present", () => {
    setEnv("TEST_OPT_PARSED", "redis-host:6380,password=secret");
    const parse = (v: string) => `parsed:${v}`;
    const config = defineConfig("test", { value: optionalParsed(parse, "TEST_OPT_PARSED") });
    expect(config.value).toBe("parsed:redis-host:6380,password=secret");
  });

  it("returns undefined when missing", () => {
    const parse = (v: string) => v;
    const config = defineConfig("test", { value: optionalParsed(parse, "TEST_OPT_PARSED_GONE") });
    expect(config.value).toBeUndefined();
  });

  it("returns undefined when parser returns empty string", () => {
    setEnv("TEST_OPT_PARSED_EMPTY", "bad");
    const parse = (v: string) => (v.startsWith("redis://") ? v : "");
    const config = defineConfig("test", {
      value: optionalParsed(parse, "TEST_OPT_PARSED_EMPTY"),
    });
    expect(config.value).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// optionalString
// ---------------------------------------------------------------------------

describe("optionalString", () => {
  it("returns the value when present", () => {
    setEnv("TEST_OPT_STR", "world");
    const config = defineConfig("test", { value: optionalString("TEST_OPT_STR") });
    expect(config.value).toBe("world");
  });

  it("returns undefined when missing", () => {
    const config = defineConfig("test", { value: optionalString("TEST_OPT_MISSING") });
    expect(config.value).toBeUndefined();
  });

  it("treats empty string as missing (returns undefined)", () => {
    setEnv("TEST_OPT_EMPTY", "");
    const config = defineConfig("test", { value: optionalString("TEST_OPT_EMPTY") });
    expect(config.value).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// defaultString
// ---------------------------------------------------------------------------

describe("defaultString", () => {
  it("returns the env value when present", () => {
    setEnv("TEST_DEF_STR", "override");
    const config = defineConfig("test", {
      value: defaultString("fallback", "TEST_DEF_STR"),
    });
    expect(config.value).toBe("override");
  });

  it("returns the default when missing", () => {
    const config = defineConfig("test", {
      value: defaultString("fallback", "TEST_DEF_MISSING"),
    });
    expect(config.value).toBe("fallback");
  });
});

// ---------------------------------------------------------------------------
// requiredInt
// ---------------------------------------------------------------------------

describe("requiredInt", () => {
  it("returns the parsed number when present", () => {
    setEnv("TEST_REQ_INT", "8080");
    const config = defineConfig("test", { value: requiredInt("TEST_REQ_INT") });
    expect(config.value).toBe(8080);
  });

  it("throws ConfigError when missing", () => {
    expect(() => defineConfig("test", { value: requiredInt("TEST_INT_GONE") })).toThrow(
      ConfigError,
    );
  });

  it("throws when value is not a valid positive integer", () => {
    setEnv("TEST_REQ_INT_BAD", "abc");
    expect(() => defineConfig("test", { value: requiredInt("TEST_REQ_INT_BAD") })).toThrow(
      "must be a positive integer",
    );
  });
});

// ---------------------------------------------------------------------------
// optionalInt
// ---------------------------------------------------------------------------

describe("optionalInt", () => {
  it("returns the parsed number when present", () => {
    setEnv("TEST_OPT_INT", "3000");
    const config = defineConfig("test", { value: optionalInt("TEST_OPT_INT") });
    expect(config.value).toBe(3000);
  });

  it("returns undefined when missing", () => {
    const config = defineConfig("test", { value: optionalInt("TEST_OPT_INT_MISSING") });
    expect(config.value).toBeUndefined();
  });

  it("throws when present but invalid", () => {
    setEnv("TEST_OPT_INT_BAD", "-1");
    expect(() => defineConfig("test", { value: optionalInt("TEST_OPT_INT_BAD") })).toThrow(
      "must be a positive integer",
    );
  });
});

// ---------------------------------------------------------------------------
// defaultInt
// ---------------------------------------------------------------------------

describe("defaultInt", () => {
  it("returns the env value when present", () => {
    setEnv("TEST_DEF_INT", "9090");
    const config = defineConfig("test", { value: defaultInt(5100, "TEST_DEF_INT") });
    expect(config.value).toBe(9090);
  });

  it("returns the default when missing", () => {
    const config = defineConfig("test", { value: defaultInt(5100, "TEST_DEF_INT_MISS") });
    expect(config.value).toBe(5100);
  });

  it("throws when present but invalid", () => {
    setEnv("TEST_DEF_INT_BAD", "0");
    expect(() => defineConfig("test", { value: defaultInt(5100, "TEST_DEF_INT_BAD") })).toThrow(
      "must be a positive integer",
    );
  });
});

// ---------------------------------------------------------------------------
// envArray
// ---------------------------------------------------------------------------

describe("envArray", () => {
  it("returns an array of indexed values", () => {
    setEnv("TEST_ARR__0", "alpha");
    setEnv("TEST_ARR__1", "bravo");
    setEnv("TEST_ARR__2", "charlie");
    const config = defineConfig("test", { items: envArray("TEST_ARR") });
    expect(config.items).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("returns empty array when no indexed env vars exist", () => {
    const config = defineConfig("test", { items: envArray("TEST_ARR_NONE") });
    expect(config.items).toEqual([]);
  });

  it("stops at first gap", () => {
    setEnv("TEST_ARR_GAP__0", "first");
    setEnv("TEST_ARR_GAP__2", "third");
    const config = defineConfig("test", { items: envArray("TEST_ARR_GAP") });
    expect(config.items).toEqual(["first"]);
  });
});

// ---------------------------------------------------------------------------
// optionalSection
// ---------------------------------------------------------------------------

describe("optionalSection", () => {
  const DEFAULTS = {
    retentionDays: 90,
    lockTtlMs: 300_000,
    batchSize: 500,
  };

  it("returns undefined when no env vars in the section exist", () => {
    const config = defineConfig("test", {
      opts: optionalSection("TEST_SEC_NONE", DEFAULTS),
    });
    expect(config.opts).toBeUndefined();
  });

  it("returns full config with defaults when one env var is set", () => {
    setEnv("TEST_SEC_ONE__RETENTIONDAYS", "30");
    const config = defineConfig("test", {
      opts: optionalSection("TEST_SEC_ONE", DEFAULTS),
    });
    expect(config.opts).toEqual({
      retentionDays: 30,
      lockTtlMs: 300_000,
      batchSize: 500,
    });
  });

  it("overrides all fields when all env vars are set", () => {
    setEnv("TEST_SEC_ALL__RETENTIONDAYS", "7");
    setEnv("TEST_SEC_ALL__LOCKTTLMS", "60000");
    setEnv("TEST_SEC_ALL__BATCHSIZE", "100");
    const config = defineConfig("test", {
      opts: optionalSection("TEST_SEC_ALL", DEFAULTS),
    });
    expect(config.opts).toEqual({
      retentionDays: 7,
      lockTtlMs: 60_000,
      batchSize: 100,
    });
  });

  it("throws when an env var in the section has an invalid value", () => {
    setEnv("TEST_SEC_BAD__RETENTIONDAYS", "abc");
    expect(() =>
      defineConfig("test", { opts: optionalSection("TEST_SEC_BAD", DEFAULTS) }),
    ).toThrow("must be a positive integer");
  });

  it("ignores empty string values (treats as not set)", () => {
    setEnv("TEST_SEC_EMPTY__RETENTIONDAYS", "");
    setEnv("TEST_SEC_EMPTY__LOCKTTLMS", "");
    const config = defineConfig("test", {
      opts: optionalSection("TEST_SEC_EMPTY", DEFAULTS),
    });
    expect(config.opts).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Aggregate errors
// ---------------------------------------------------------------------------

describe("aggregate errors", () => {
  it("collects all missing required fields in one error", () => {
    expect(() =>
      defineConfig("my-service", {
        a: requiredString("MISSING_A"),
        b: requiredString("MISSING_B"),
        c: requiredInt("MISSING_C"),
      }),
    ).toThrow("my-service: missing required config — MISSING_A, MISSING_B, MISSING_C");
  });

  it("throws ConfigError (not generic Error)", () => {
    try {
      defineConfig("svc", { x: requiredString("NOPE") });
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).name).toBe("ConfigError");
    }
  });
});

// ---------------------------------------------------------------------------
// Alternate env keys
// ---------------------------------------------------------------------------

describe("alternate env keys", () => {
  it("uses the first matching key", () => {
    setEnv("ALT_KEY_2", "second");
    const config = defineConfig("test", {
      value: requiredString("ALT_KEY_1", "ALT_KEY_2"),
    });
    expect(config.value).toBe("second");
  });

  it("prefers the first key when both are set", () => {
    setEnv("ALT_FIRST", "first");
    setEnv("ALT_SECOND", "second");
    const config = defineConfig("test", {
      value: requiredString("ALT_FIRST", "ALT_SECOND"),
    });
    expect(config.value).toBe("first");
  });
});

// ---------------------------------------------------------------------------
// Frozen result
// ---------------------------------------------------------------------------

describe("frozen result", () => {
  it("returns an Object.freeze()d config", () => {
    setEnv("TEST_FREEZE", "value");
    const config = defineConfig("test", { v: requiredString("TEST_FREEZE") });
    expect(Object.isFrozen(config)).toBe(true);
  });
});
