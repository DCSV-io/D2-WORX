import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// We can't test loadEnv() directly from the real module because it has a
// module-level `loaded` guard (singleton). Instead, we test the parsing logic
// by re-importing with resetModules, and test findEnvFile by creating real
// temp directories with .env.local files.
// ---------------------------------------------------------------------------

describe("loadEnv", () => {
  const keysSet: string[] = [];
  let tempDir: string;

  function setEnv(key: string, value: string): void {
    process.env[key] = value;
    keysSet.push(key);
  }

  beforeEach(() => {
    vi.resetModules();
    tempDir = resolve(tmpdir(), `d2-load-env-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    for (const key of keysSet) {
      delete process.env[key];
    }
    keysSet.length = 0;

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  });

  it("sets env vars from a .env.local file", async () => {
    // Arrange — write a .env.local in a temp dir.
    const envFile = resolve(tempDir, ".env.local");
    writeFileSync(envFile, "LOAD_ENV_TEST_A=hello\nLOAD_ENV_TEST_B=world\n");
    keysSet.push("LOAD_ENV_TEST_A", "LOAD_ENV_TEST_B");

    // We need a fresh module with a fresh `loaded` flag, using the temp dir as cwd.
    const originalCwd = process.cwd();
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    // Act — dynamically import to get a fresh module instance.
    const { loadEnv } = await import("@d2/service-defaults/config");
    // Reset the module's loaded state by accessing internal state via re-import.
    // Since vi.resetModules() was called in beforeEach, this is a fresh import.
    loadEnv();

    vi.spyOn(process, "cwd").mockReturnValue(originalCwd);

    // Assert
    expect(process.env.LOAD_ENV_TEST_A).toBe("hello");
    expect(process.env.LOAD_ENV_TEST_B).toBe("world");
  });

  it("does not overwrite existing env vars", async () => {
    // Arrange — pre-set an env var that also exists in the file.
    setEnv("LOAD_ENV_NOOVERWRITE", "original");

    const envFile = resolve(tempDir, ".env.local");
    writeFileSync(envFile, "LOAD_ENV_NOOVERWRITE=replaced\n");

    vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    // Act
    const { loadEnv } = await import("@d2/service-defaults/config");
    loadEnv();

    // Assert — the pre-existing value must survive.
    expect(process.env.LOAD_ENV_NOOVERWRITE).toBe("original");
  });

  it("skips comment lines and empty lines", async () => {
    const envFile = resolve(tempDir, ".env.local");
    writeFileSync(
      envFile,
      [
        "# This is a comment",
        "",
        "  # Indented comment",
        "LOAD_ENV_COMMENT_TEST=works",
        "",
      ].join("\n"),
    );
    keysSet.push("LOAD_ENV_COMMENT_TEST");

    vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    // Act
    const { loadEnv } = await import("@d2/service-defaults/config");
    loadEnv();

    // Assert
    expect(process.env.LOAD_ENV_COMMENT_TEST).toBe("works");
  });

  it("handles values containing equals signs", async () => {
    const envFile = resolve(tempDir, ".env.local");
    writeFileSync(envFile, "LOAD_ENV_EQUALS=redis://:p@ss=word@host:6379\n");
    keysSet.push("LOAD_ENV_EQUALS");

    vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    // Act
    const { loadEnv } = await import("@d2/service-defaults/config");
    loadEnv();

    // Assert — everything after the first = is the value.
    expect(process.env.LOAD_ENV_EQUALS).toBe("redis://:p@ss=word@host:6379");
  });

  it("is safe to call multiple times (no-op after first)", async () => {
    const envFile = resolve(tempDir, ".env.local");
    writeFileSync(envFile, "LOAD_ENV_MULTI=first\n");
    keysSet.push("LOAD_ENV_MULTI");

    vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    const { loadEnv } = await import("@d2/service-defaults/config");
    loadEnv();

    // Overwrite the file — second call should not re-read.
    writeFileSync(envFile, "LOAD_ENV_MULTI=second\n");
    loadEnv();

    // Assert — still the first value.
    expect(process.env.LOAD_ENV_MULTI).toBe("first");
  });

  it("walks up directories to find .env.local", async () => {
    // Arrange — create a nested dir structure: tempDir/.env.local + tempDir/child/grandchild/
    const envFile = resolve(tempDir, ".env.local");
    writeFileSync(envFile, "LOAD_ENV_WALK=found\n");
    keysSet.push("LOAD_ENV_WALK");

    const nested = resolve(tempDir, "child", "grandchild");
    mkdirSync(nested, { recursive: true });

    vi.spyOn(process, "cwd").mockReturnValue(nested);

    // Act
    const { loadEnv } = await import("@d2/service-defaults/config");
    loadEnv();

    // Assert
    expect(process.env.LOAD_ENV_WALK).toBe("found");
  });

  it("prefers .env.local over .env", async () => {
    writeFileSync(resolve(tempDir, ".env.local"), "LOAD_ENV_PREFER=local\n");
    writeFileSync(resolve(tempDir, ".env"), "LOAD_ENV_PREFER=default\n");
    keysSet.push("LOAD_ENV_PREFER");

    vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    const { loadEnv } = await import("@d2/service-defaults/config");
    loadEnv();

    expect(process.env.LOAD_ENV_PREFER).toBe("local");
  });

  it("falls back to .env when .env.local is absent", async () => {
    writeFileSync(resolve(tempDir, ".env"), "LOAD_ENV_FALLBACK=default\n");
    keysSet.push("LOAD_ENV_FALLBACK");

    vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    const { loadEnv } = await import("@d2/service-defaults/config");
    loadEnv();

    expect(process.env.LOAD_ENV_FALLBACK).toBe("default");
  });
});
