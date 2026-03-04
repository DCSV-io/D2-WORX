import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Helper: creates a constructable mock class.
function mockClass(props: Record<string, unknown> = {}) {
  return class {
    constructor() {
      Object.assign(this, { handleAsync: vi.fn(), ...props });
    }
  };
}

// Mock all @d2/* modules before importing the module under test.
vi.mock("ioredis", () => ({
  default: class Redis {},
}));

vi.mock("@d2/logging", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@d2/handler", () => ({
  HandlerContext: class HandlerContext {
    constructor(
      public request: unknown,
      public logger: unknown,
    ) {}
  },
}));

vi.mock("@d2/service-defaults/config", () => ({
  parseRedisUrl: vi.fn().mockReturnValue("redis://:pass@localhost:6379"),
}));

vi.mock("@d2/cache-redis", () => ({
  Get: mockClass(),
  Set: mockClass(),
  SetNx: mockClass(),
  Remove: mockClass(),
  Exists: mockClass(),
  GetTtl: mockClass(),
  Increment: mockClass(),
}));

vi.mock("@d2/cache-memory", () => ({
  MemoryCacheStore: class MemoryCacheStore {},
}));

vi.mock("@d2/geo-client", () => ({
  createGeoServiceClient: vi.fn().mockReturnValue({}),
  FindWhoIs: mockClass(),
  DEFAULT_GEO_CLIENT_OPTIONS: { allowedContextKeys: [], apiKey: "" },
}));

vi.mock("@d2/ratelimit", () => ({
  Check: mockClass(),
}));

vi.mock("@d2/idempotency", () => ({
  Check: mockClass(),
  checkIdempotency: vi.fn(),
}));

vi.mock("@d2/request-enrichment", () => ({
  enrichRequest: vi.fn(),
}));

describe("middleware.server", () => {
  const ENV_BACKUP: Record<string, string | undefined> = {};

  function setEnv(key: string, value: string) {
    ENV_BACKUP[key] = process.env[key];
    process.env[key] = value;
  }

  function setRequiredEnv() {
    setEnv("REDIS_URL", "redis://:pass@localhost:6379");
    setEnv("GEO_GRPC_ADDRESS", "localhost:5138");
    setEnv("SVELTEKIT_GEO_CLIENT__APIKEY", "test-key");
  }

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(ENV_BACKUP)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    Object.keys(ENV_BACKUP).forEach((k) => delete ENV_BACKUP[k]);
  });

  it("returns null when Redis connection string is missing", async () => {
    setEnv("GEO_GRPC_ADDRESS", "localhost:5138");
    setEnv("SVELTEKIT_GEO_CLIENT__APIKEY", "test-key");

    const { getMiddlewareContext } = await import("./middleware.server");
    const ctx = getMiddlewareContext();

    expect(ctx).toBeNull();
  });

  it("returns null when GEO_GRPC_ADDRESS is missing", async () => {
    setEnv("REDIS_URL", "redis://:pass@localhost:6379");
    setEnv("SVELTEKIT_GEO_CLIENT__APIKEY", "test-key");

    const { getMiddlewareContext } = await import("./middleware.server");
    const ctx = getMiddlewareContext();

    expect(ctx).toBeNull();
  });

  it("returns null when SVELTEKIT_GEO_CLIENT__APIKEY is missing", async () => {
    setEnv("REDIS_URL", "redis://:pass@localhost:6379");
    setEnv("GEO_GRPC_ADDRESS", "localhost:5138");

    const { getMiddlewareContext } = await import("./middleware.server");
    const ctx = getMiddlewareContext();

    expect(ctx).toBeNull();
  });

  it("returns context when all env vars are present", async () => {
    setRequiredEnv();

    const { getMiddlewareContext } = await import("./middleware.server");
    const ctx = getMiddlewareContext();

    expect(ctx).not.toBeNull();
    expect(ctx!.logger).toBeDefined();
    expect(ctx!.findWhoIs).toBeDefined();
    expect(ctx!.rateLimitCheck).toBeDefined();
    expect(ctx!.idempotencyCheck).toBeDefined();
    expect(ctx!.redisSet).toBeDefined();
    expect(ctx!.redisRemove).toBeDefined();
  });

  it("returns cached singleton on subsequent calls", async () => {
    setRequiredEnv();

    const { getMiddlewareContext } = await import("./middleware.server");
    const ctx1 = getMiddlewareContext();
    const ctx2 = getMiddlewareContext();

    expect(ctx1).toBe(ctx2);
  });

  it("only attempts initialization once when env vars are missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getMiddlewareContext } = await import("./middleware.server");
    getMiddlewareContext();
    getMiddlewareContext();
    getMiddlewareContext();

    // Should only log the warning once (first attempt)
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
