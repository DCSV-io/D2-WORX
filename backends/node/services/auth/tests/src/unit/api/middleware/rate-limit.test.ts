import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createRateLimitMiddleware } from "@d2/auth-api";

describe("Rate limit middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createApp(maxRequests: number, windowMs: number) {
    const app = new Hono();
    app.use("*", createRateLimitMiddleware(maxRequests, windowMs));
    app.get("/test", (c) => c.json({ ok: true }));
    return app;
  }

  it("should allow requests under the limit", async () => {
    const app = createApp(3, 60_000);

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/test", {
        headers: { "x-real-ip": "1.2.3.4" },
      });
      expect(res.status).toBe(200);
    }
  });

  it("should reject requests over the limit with 429", async () => {
    const app = createApp(2, 60_000);

    // First 2 pass
    await app.request("/test", { headers: { "x-real-ip": "1.2.3.4" } });
    await app.request("/test", { headers: { "x-real-ip": "1.2.3.4" } });

    // 3rd blocked
    const res = await app.request("/test", {
      headers: { "x-real-ip": "1.2.3.4" },
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.messages[0]).toContain("Too many requests");
  });

  it("should track different IPs independently", async () => {
    const app = createApp(1, 60_000);

    const res1 = await app.request("/test", {
      headers: { "x-real-ip": "1.1.1.1" },
    });
    expect(res1.status).toBe(200);

    const res2 = await app.request("/test", {
      headers: { "x-real-ip": "2.2.2.2" },
    });
    expect(res2.status).toBe(200);

    // Same IP again → blocked
    const res3 = await app.request("/test", {
      headers: { "x-real-ip": "1.1.1.1" },
    });
    expect(res3.status).toBe(429);
  });

  it("should reset the window after expiry", async () => {
    const app = createApp(1, 10_000);

    const res1 = await app.request("/test", {
      headers: { "x-real-ip": "1.2.3.4" },
    });
    expect(res1.status).toBe(200);

    const res2 = await app.request("/test", {
      headers: { "x-real-ip": "1.2.3.4" },
    });
    expect(res2.status).toBe(429);

    // Advance past window
    vi.advanceTimersByTime(11_000);

    const res3 = await app.request("/test", {
      headers: { "x-real-ip": "1.2.3.4" },
    });
    expect(res3.status).toBe(200);
  });

  it("should prefer CF-Connecting-IP over other IP headers", async () => {
    const app = createApp(1, 60_000);

    await app.request("/test", {
      headers: {
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
      },
    });

    // Same CF IP blocked
    const res = await app.request("/test", {
      headers: {
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "3.3.3.3",
      },
    });
    expect(res.status).toBe(429);

    // Different CF IP OK
    const res2 = await app.request("/test", {
      headers: {
        "cf-connecting-ip": "4.4.4.4",
      },
    });
    expect(res2.status).toBe(200);
  });

  it("should handle X-Forwarded-For with multiple IPs (take first)", async () => {
    const app = createApp(1, 60_000);

    await app.request("/test", {
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" },
    });

    // Same first IP → blocked
    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "1.1.1.1, 9.9.9.9" },
    });
    expect(res.status).toBe(429);
  });

  it("should return D2Result-shaped response on 429", async () => {
    const app = createApp(0, 60_000);

    const res = await app.request("/test", {
      headers: { "x-real-ip": "1.2.3.4" },
    });
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body).toHaveProperty("success", false);
    expect(body).toHaveProperty("statusCode", 429);
    expect(body).toHaveProperty("messages");
    expect(Array.isArray(body.messages)).toBe(true);
  });
});
