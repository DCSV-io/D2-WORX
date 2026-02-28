import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseConfig, logConfig, type DkronMgrConfig } from "@d2/dkron-mgr";
import { ConfigError } from "@d2/service-defaults/config";
import type { ILogger } from "@d2/logging";

function createSilentLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

describe("parseConfig", () => {
  let logger: ILogger;
  const originalEnv = process.env;

  beforeEach(() => {
    logger = createSilentLogger();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should parse all required env vars", () => {
    process.env.DKRON_MGR__DKRON_URL = "http://localhost:8888";
    process.env.DKRON_MGR__GATEWAY_URL = "http://host.docker.internal:5461";
    process.env.DKRON_MGR__SERVICE_KEY = "test-key-12345";

    const config = parseConfig(logger);

    expect(config.dkronUrl).toBe("http://localhost:8888");
    expect(config.gatewayUrl).toBe("http://host.docker.internal:5461");
    expect(config.serviceKey).toBe("test-key-12345");
  });

  it("should use default reconcile interval when not set", () => {
    process.env.DKRON_MGR__DKRON_URL = "http://localhost:8888";
    process.env.DKRON_MGR__GATEWAY_URL = "http://gateway:5461";
    process.env.DKRON_MGR__SERVICE_KEY = "key";

    const config = parseConfig(logger);

    expect(config.reconcileIntervalMs).toBe(300_000);
  });

  it("should parse custom reconcile interval", () => {
    process.env.DKRON_MGR__DKRON_URL = "http://localhost:8888";
    process.env.DKRON_MGR__GATEWAY_URL = "http://gateway:5461";
    process.env.DKRON_MGR__SERVICE_KEY = "key";
    process.env.DKRON_MGR__RECONCILE_INTERVAL_MS = "60000";

    const config = parseConfig(logger);

    expect(config.reconcileIntervalMs).toBe(60_000);
  });

  it("should strip trailing slashes from URLs", () => {
    process.env.DKRON_MGR__DKRON_URL = "http://localhost:8888///";
    process.env.DKRON_MGR__GATEWAY_URL = "http://gateway:5461/";
    process.env.DKRON_MGR__SERVICE_KEY = "key";

    const config = parseConfig(logger);

    expect(config.dkronUrl).toBe("http://localhost:8888");
    expect(config.gatewayUrl).toBe("http://gateway:5461");
  });

  it("should throw ConfigError when DKRON_URL is missing", () => {
    process.env.DKRON_MGR__GATEWAY_URL = "http://gateway:5461";
    process.env.DKRON_MGR__SERVICE_KEY = "key";

    expect(() => parseConfig(logger)).toThrow(ConfigError);
    expect(() => parseConfig(logger)).toThrow(/DKRON_MGR__DKRON_URL/);
  });

  it("should throw ConfigError listing all missing required vars", () => {
    expect(() => parseConfig(logger)).toThrow(ConfigError);
    try {
      parseConfig(logger);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("DKRON_MGR__DKRON_URL");
      expect(msg).toContain("DKRON_MGR__GATEWAY_URL");
      expect(msg).toContain("DKRON_MGR__SERVICE_KEY");
    }
  });

  it("should fall back to default when interval is non-numeric", () => {
    process.env.DKRON_MGR__DKRON_URL = "http://localhost:8888";
    process.env.DKRON_MGR__GATEWAY_URL = "http://gateway:5461";
    process.env.DKRON_MGR__SERVICE_KEY = "key";
    process.env.DKRON_MGR__RECONCILE_INTERVAL_MS = "not-a-number";

    const config = parseConfig(logger);

    expect(config.reconcileIntervalMs).toBe(300_000);
  });

  it("should fall back to default when interval is zero", () => {
    process.env.DKRON_MGR__DKRON_URL = "http://localhost:8888";
    process.env.DKRON_MGR__GATEWAY_URL = "http://gateway:5461";
    process.env.DKRON_MGR__SERVICE_KEY = "key";
    process.env.DKRON_MGR__RECONCILE_INTERVAL_MS = "0";

    const config = parseConfig(logger);

    expect(config.reconcileIntervalMs).toBe(300_000);
  });

  it("should fall back to default when interval is negative", () => {
    process.env.DKRON_MGR__DKRON_URL = "http://localhost:8888";
    process.env.DKRON_MGR__GATEWAY_URL = "http://gateway:5461";
    process.env.DKRON_MGR__SERVICE_KEY = "key";
    process.env.DKRON_MGR__RECONCILE_INTERVAL_MS = "-5000";

    const config = parseConfig(logger);

    expect(config.reconcileIntervalMs).toBe(300_000);
  });

  it("should return a frozen config object", () => {
    process.env.DKRON_MGR__DKRON_URL = "http://localhost:8888";
    process.env.DKRON_MGR__GATEWAY_URL = "http://gateway:5461";
    process.env.DKRON_MGR__SERVICE_KEY = "key";

    const config = parseConfig(logger);

    expect(Object.isFrozen(config)).toBe(true);
  });
});

describe("logConfig", () => {
  it("should redact long service keys", () => {
    const logger = createSilentLogger();
    const config: DkronMgrConfig = {
      dkronUrl: "http://localhost:8888",
      gatewayUrl: "http://gateway:5461",
      serviceKey: "super-secret-long-key-12345",
      reconcileIntervalMs: 300_000,
    };

    logConfig(config, logger);

    const logged = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<
      string,
      unknown
    >;
    expect(logged.serviceKey).toBe("super-se...");
    expect(logged.serviceKey).not.toContain("12345");
  });

  it("should fully redact short service keys", () => {
    const logger = createSilentLogger();
    const config: DkronMgrConfig = {
      dkronUrl: "http://localhost:8888",
      gatewayUrl: "http://gateway:5461",
      serviceKey: "short",
      reconcileIntervalMs: 300_000,
    };

    logConfig(config, logger);

    const logged = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<
      string,
      unknown
    >;
    expect(logged.serviceKey).toBe("***");
  });
});
