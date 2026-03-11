import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JwtManager } from "../jwt-manager.js";
import type { AuthBffConfig } from "../types.js";
import type { ILogger } from "@d2/logging";

function createSilentLogger(): ILogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  } as unknown as ILogger;
}

const config: AuthBffConfig = { authServiceUrl: "http://localhost:5100" };

/** Creates a fake JWT with the given expiry (seconds since epoch). */
function fakeJwt(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds, sub: "user-1" })).toString(
    "base64url",
  );
  const sig = Buffer.from("fake-signature").toString("base64url");
  return `${header}.${payload}.${sig}`;
}

function mockTokenResponse(token: string, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ token }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("JwtManager", () => {
  let manager: JwtManager;
  let logger: ILogger;

  beforeEach(() => {
    logger = createSilentLogger();
    manager = new JwtManager(config, logger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should obtain JWT from Auth service", async () => {
    const token = fakeJwt(Math.floor(Date.now() / 1000) + 900);
    vi.stubGlobal("fetch", mockTokenResponse(token));

    const result = await manager.getToken("session_token=abc");

    expect(result).toBe(token);
  });

  it("should cache JWT and return cached on subsequent calls", async () => {
    const token = fakeJwt(Math.floor(Date.now() / 1000) + 900);
    const fetchMock = mockTokenResponse(token);
    vi.stubGlobal("fetch", fetchMock);

    const first = await manager.getToken("session_token=abc");
    const second = await manager.getToken("session_token=abc");

    expect(first).toBe(token);
    expect(second).toBe(token);
    expect(fetchMock).toHaveBeenCalledOnce(); // Only one fetch
  });

  it("should refresh JWT when cached token is near expiry", async () => {
    vi.useFakeTimers();
    const now = Date.now();

    // First token expires 4 minutes from now (within 3-minute refresh buffer)
    const token1 = fakeJwt(Math.floor((now + 4 * 60 * 1000) / 1000));
    const token2 = fakeJwt(Math.floor((now + 15 * 60 * 1000 + 4 * 60 * 1000) / 1000));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        const token = callCount === 1 ? token1 : token2;
        return Promise.resolve(
          new Response(JSON.stringify({ token }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    // First call gets token1
    const first = await manager.getToken("session_token=abc");
    expect(first).toBe(token1);

    // Advance time so token1 is within refresh buffer
    vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes later, only ~2min left

    // Second call should trigger a refresh
    const second = await manager.getToken("session_token=abc");
    expect(second).toBe(token2);
    expect(callCount).toBe(2);
  });

  it("should deduplicate concurrent refresh requests", async () => {
    const token = fakeJwt(Math.floor(Date.now() / 1000) + 900);
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ token }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                }),
              ),
            50,
          ),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Fire 3 concurrent requests
    const [r1, r2, r3] = await Promise.all([
      manager.getToken("session_token=abc"),
      manager.getToken("session_token=abc"),
      manager.getToken("session_token=abc"),
    ]);

    expect(r1).toBe(token);
    expect(r2).toBe(token);
    expect(r3).toBe(token);
    expect(fetchMock).toHaveBeenCalledOnce(); // Single fetch despite 3 concurrent calls
  });

  it("should return null on auth service failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Internal" }), { status: 500 }),
      ),
    );

    const result = await manager.getToken("session_token=abc");

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("should clear cache on explicit invalidation", async () => {
    const token1 = fakeJwt(Math.floor(Date.now() / 1000) + 900);
    const token2 = fakeJwt(Math.floor(Date.now() / 1000) + 900);

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        const token = callCount === 1 ? token1 : token2;
        return Promise.resolve(
          new Response(JSON.stringify({ token }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    const first = await manager.getToken("session_token=abc");
    expect(first).toBe(token1);

    manager.invalidate();

    const second = await manager.getToken("session_token=abc");
    expect(second).toBe(token2);
    expect(callCount).toBe(2);
  });

  it("should isolate cached tokens per session (no cross-user leakage)", async () => {
    const tokenA = fakeJwt(Math.floor(Date.now() / 1000) + 900);
    const tokenB = fakeJwt(Math.floor(Date.now() / 1000) + 900);

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: { headers: Record<string, string> }) => {
        callCount++;
        // Return different tokens based on which session cookie was sent
        const token = init.headers.cookie === "session_token=user_a" ? tokenA : tokenB;
        return Promise.resolve(
          new Response(JSON.stringify({ token }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    // User A gets their token
    const resultA = await manager.getToken("session_token=user_a");
    expect(resultA).toBe(tokenA);

    // User B gets a DIFFERENT token (not User A's cached token)
    const resultB = await manager.getToken("session_token=user_b");
    expect(resultB).toBe(tokenB);

    // Both fetched independently
    expect(callCount).toBe(2);

    // Subsequent calls return the correct cached token for each user
    const resultA2 = await manager.getToken("session_token=user_a");
    const resultB2 = await manager.getToken("session_token=user_b");
    expect(resultA2).toBe(tokenA);
    expect(resultB2).toBe(tokenB);
    expect(callCount).toBe(2); // No additional fetches — both cached
  });

  it("should invalidate only the specified session when cookie is provided", async () => {
    const tokenA = fakeJwt(Math.floor(Date.now() / 1000) + 900);
    const tokenB = fakeJwt(Math.floor(Date.now() / 1000) + 900);
    const tokenA2 = fakeJwt(Math.floor(Date.now() / 1000) + 900);

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: { headers: Record<string, string> }) => {
        callCount++;
        if (init.headers.cookie === "session_token=user_a") {
          return Promise.resolve(
            new Response(JSON.stringify({ token: callCount <= 2 ? tokenA : tokenA2 }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ token: tokenB }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    // Cache tokens for both users
    await manager.getToken("session_token=user_a");
    await manager.getToken("session_token=user_b");
    expect(callCount).toBe(2);

    // Invalidate only User A
    manager.invalidate("session_token=user_a");

    // User B still cached, User A must re-fetch
    const resultB = await manager.getToken("session_token=user_b");
    expect(resultB).toBe(tokenB);
    expect(callCount).toBe(2); // No new fetch for B

    const resultA = await manager.getToken("session_token=user_a");
    expect(resultA).toBe(tokenA2);
    expect(callCount).toBe(3); // New fetch for A
  });

  it("should return null when response has no token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await manager.getToken("session_token=abc");

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("should send X-Api-Key header when apiKey is configured", async () => {
    const token = fakeJwt(Math.floor(Date.now() / 1000) + 900);
    const fetchMock = mockTokenResponse(token);
    vi.stubGlobal("fetch", fetchMock);

    const trustedManager = new JwtManager(
      { authServiceUrl: "http://localhost:5100", apiKey: "d2.sveltekit.auth.key" },
      logger,
    );

    await trustedManager.getToken("session_token=abc");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["x-api-key"]).toBe("d2.sveltekit.auth.key");
  });

  it("should not send X-Api-Key header when apiKey is not configured", async () => {
    const token = fakeJwt(Math.floor(Date.now() / 1000) + 900);
    const fetchMock = mockTokenResponse(token);
    vi.stubGlobal("fetch", fetchMock);

    await manager.getToken("session_token=abc");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["x-api-key"]).toBeUndefined();
  });

  it("should handle network error gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await manager.getToken("session_token=abc");

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });
});
