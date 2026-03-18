import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { CheckHealth } from "@d2/files-app";
import {
  createMockPingDb,
  createMockStorage,
  createMockContext,
} from "../../helpers/mock-handlers.js";

describe("CheckHealth", () => {
  it("should return healthy when all components are healthy", async () => {
    const pingDb = createMockPingDb(true);
    const storage = createMockStorage();
    const context = createMockContext();
    const handler = new CheckHealth(pingDb as never, storage, context);

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("healthy");
    expect(result.data?.components["db"]?.status).toBe("healthy");
    expect(result.data?.components["storage"]?.status).toBe("healthy");
  });

  it("should return degraded when DB is unhealthy", async () => {
    const pingDb = createMockPingDb(false);
    const storage = createMockStorage();
    const context = createMockContext();
    const handler = new CheckHealth(pingDb as never, storage, context);

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("degraded");
    expect(result.data?.components["db"]?.status).toBe("unhealthy");
  });

  it("should return degraded when storage is unhealthy", async () => {
    const pingDb = createMockPingDb(true);
    const storage = createMockStorage();
    vi.mocked(storage.ping.handleAsync).mockResolvedValue(
      D2Result.ok({ data: { healthy: false, latencyMs: 0, error: "timeout" } }),
    );
    const context = createMockContext();
    const handler = new CheckHealth(pingDb as never, storage, context);

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("degraded");
    expect(result.data?.components["storage"]?.status).toBe("unhealthy");
    expect(result.data?.components["storage"]?.error).toBe("timeout");
  });

  it("should include latencyMs from components", async () => {
    const pingDb = createMockPingDb(true);
    const storage = createMockStorage();
    vi.mocked(storage.ping.handleAsync).mockResolvedValue(
      D2Result.ok({ data: { healthy: true, latencyMs: 42 } }),
    );
    const context = createMockContext();
    const handler = new CheckHealth(pingDb as never, storage, context);

    const result = await handler.handleAsync({});

    expect(result.data?.components["storage"]?.latencyMs).toBe(42);
  });
});
