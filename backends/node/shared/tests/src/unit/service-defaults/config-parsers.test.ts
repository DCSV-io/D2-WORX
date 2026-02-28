import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseEnvArray, parsePostgresUrl, parseRedisUrl } from "@d2/service-defaults/config";

// ---------------------------------------------------------------------------
// parseEnvArray
// ---------------------------------------------------------------------------

describe("parseEnvArray", () => {
  const PREFIX = "TEST_PARSE_ENV_ARRAY";

  /** Track every key we set so afterEach can clean up reliably. */
  const keysSet: string[] = [];

  function setEnv(index: number, value: string): void {
    const key = `${PREFIX}__${index}`;
    process.env[key] = value;
    keysSet.push(key);
  }

  afterEach(() => {
    for (const key of keysSet) {
      delete process.env[key];
    }
    keysSet.length = 0;
  });

  it("returns empty array when no matching env vars exist", () => {
    expect(parseEnvArray(PREFIX)).toEqual([]);
  });

  it("returns single-element array when only index 0 exists", () => {
    setEnv(0, "only-value");
    expect(parseEnvArray(PREFIX)).toEqual(["only-value"]);
  });

  it("returns multiple elements in order", () => {
    setEnv(0, "alpha");
    setEnv(1, "bravo");
    setEnv(2, "charlie");
    expect(parseEnvArray(PREFIX)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("stops at first gap in index sequence (0,1,3 returns only 0,1)", () => {
    setEnv(0, "first");
    setEnv(1, "second");
    // skip index 2
    setEnv(3, "fourth");
    expect(parseEnvArray(PREFIX)).toEqual(["first", "second"]);
  });

  it("includes empty string values (index exists but value is empty)", () => {
    setEnv(0, "has-value");
    setEnv(1, "");
    setEnv(2, "after-empty");
    expect(parseEnvArray(PREFIX)).toEqual(["has-value", "", "after-empty"]);
  });
});

// ---------------------------------------------------------------------------
// parsePostgresUrl
// ---------------------------------------------------------------------------

describe("parsePostgresUrl", () => {
  it("passes through postgresql:// URIs unchanged", () => {
    const uri = "postgresql://admin:s3cr3t@db:5432/app";
    expect(parsePostgresUrl(uri)).toBe(uri);
  });

  it("passes through postgres:// URIs unchanged", () => {
    const uri = "postgres://user:pass@host:5433/mydb";
    expect(parsePostgresUrl(uri)).toBe(uri);
  });

  it("converts full ADO.NET connection string", () => {
    const ado = "Host=myhost;Port=5433;Username=admin;Password=s3cr3t;Database=mydb";
    expect(parsePostgresUrl(ado)).toBe("postgresql://admin:s3cr3t@myhost:5433/mydb");
  });

  it("uses defaults for missing fields (localhost:5432, postgres user)", () => {
    const ado = "Database=mydb";
    expect(parsePostgresUrl(ado)).toBe("postgresql://postgres:@localhost:5432/mydb");
  });

  it("URL-encodes special characters in password", () => {
    const ado = "Host=db;Port=5432;Username=admin;Password=p@ss=w/rd;Database=app";
    const result = parsePostgresUrl(ado);
    expect(result).toBe("postgresql://admin:p%40ss%3Dw%2Frd@db:5432/app");
  });

  it("handles whitespace around keys and values", () => {
    const ado =
      " Host = myhost ; Port = 5432 ; Username = admin ; Password = pass ; Database = db ";
    expect(parsePostgresUrl(ado)).toBe("postgresql://admin:pass@myhost:5432/db");
  });

  it("treats key names as case-insensitive", () => {
    const ado = "HOST=myhost;PORT=5433;USERNAME=admin;PASSWORD=secret;DATABASE=mydb";
    expect(parsePostgresUrl(ado)).toBe("postgresql://admin:secret@myhost:5433/mydb");
  });

  it("returns empty string for empty input", () => {
    expect(parsePostgresUrl("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(parsePostgresUrl("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// parseRedisUrl
// ---------------------------------------------------------------------------

describe("parseRedisUrl", () => {
  it("passes through redis:// URIs unchanged", () => {
    const uri = "redis://localhost:6379";
    expect(parseRedisUrl(uri)).toBe(uri);
  });

  it("passes through rediss:// (TLS) URIs unchanged", () => {
    const uri = "rediss://secure-host:6380";
    expect(parseRedisUrl(uri)).toBe(uri);
  });

  it("converts StackExchange format with password", () => {
    const se = "redis-host:6380,password=s3cr3t";
    expect(parseRedisUrl(se)).toBe("redis://:s3cr3t@redis-host:6380");
  });

  it("converts StackExchange format without password", () => {
    const se = "redis-host:6380";
    expect(parseRedisUrl(se)).toBe("redis://redis-host:6380");
  });

  it("uses default port 6379 when port not specified in host", () => {
    const se = "redis-host,password=secret";
    expect(parseRedisUrl(se)).toBe("redis://:secret@redis-host:6379");
  });

  it("URL-encodes special characters in password", () => {
    const se = "redis-host:6380,password=p@ss=w/rd";
    expect(parseRedisUrl(se)).toBe("redis://:p%40ss%3Dw%2Frd@redis-host:6380");
  });

  it("returns empty string for empty input", () => {
    expect(parseRedisUrl("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(parseRedisUrl("   ")).toBe("");
  });
});
