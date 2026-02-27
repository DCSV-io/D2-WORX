import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createCsrfMiddleware } from "@d2/auth-api";

function createApp(allowedOrigin: string) {
  const app = new Hono();
  app.use("*", createCsrfMiddleware(allowedOrigin));
  app.get("/test", (c) => c.json({ ok: true }));
  app.post("/test", (c) => c.json({ ok: true }));
  app.put("/test", (c) => c.json({ ok: true }));
  app.patch("/test", (c) => c.json({ ok: true }));
  app.delete("/test", (c) => c.json({ ok: true }));
  return app;
}

describe("CSRF middleware", () => {
  const ORIGIN = "https://app.example.com";
  const app = createApp(ORIGIN);

  describe("safe methods (GET)", () => {
    it("should pass through GET requests without any checks", async () => {
      const res = await app.request("/test", { method: "GET" });
      expect(res.status).toBe(200);
    });
  });

  describe("Content-Type / custom header check", () => {
    it("should reject POST without Content-Type or X-Requested-With", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: { origin: ORIGIN },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.messages[0]).toContain("Content-Type");
    });

    it("should pass POST with Content-Type: application/json", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
        },
        body: "{}",
      });
      expect(res.status).toBe(200);
    });

    it("should pass POST with Content-Type: application/json; charset=utf-8", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          origin: ORIGIN,
        },
        body: "{}",
      });
      expect(res.status).toBe(200);
    });

    it("should pass POST with X-Requested-With header", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "x-requested-with": "XMLHttpRequest",
          origin: ORIGIN,
        },
      });
      expect(res.status).toBe(200);
    });

    it("should reject PUT without Content-Type or X-Requested-With", async () => {
      const res = await app.request("/test", {
        method: "PUT",
        headers: { origin: ORIGIN },
      });
      expect(res.status).toBe(403);
    });

    it("should reject PATCH without Content-Type or X-Requested-With", async () => {
      const res = await app.request("/test", {
        method: "PATCH",
        headers: { origin: ORIGIN },
      });
      expect(res.status).toBe(403);
    });

    it("should reject DELETE without Content-Type or X-Requested-With", async () => {
      const res = await app.request("/test", {
        method: "DELETE",
        headers: { origin: ORIGIN },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("Origin validation", () => {
    it("should reject POST with wrong Origin", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.com",
        },
        body: "{}",
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.messages[0]).toContain("origin");
    });

    it("should pass POST when Origin matches", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
        },
        body: "{}",
      });
      expect(res.status).toBe(200);
    });

    it("should pass POST when Origin header is absent (non-browser client)", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{}",
      });
      expect(res.status).toBe(200);
    });

    it("should normalize trailing slash on Origin", async () => {
      const appWithSlash = createApp("https://app.example.com/");
      const res = await appWithSlash.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.example.com",
        },
        body: "{}",
      });
      expect(res.status).toBe(200);
    });

    it("should normalize trailing slash on request Origin", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.example.com/",
        },
        body: "{}",
      });
      expect(res.status).toBe(200);
    });

    it("should reject partial origin match (subdomain attack)", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.example.com.evil.com",
        },
        body: "{}",
      });
      expect(res.status).toBe(403);
    });

    it("should reject 'null' origin string (sandboxed iframe)", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "null",
        },
        body: "{}",
      });
      expect(res.status).toBe(403);
    });

    it("should reject origin with different port", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.example.com:8080",
        },
        body: "{}",
      });
      expect(res.status).toBe(403);
    });

    it("should reject origin with different scheme (http vs https)", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://app.example.com",
        },
        body: "{}",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("Content-Type bypass attempts", () => {
    it("should reject text/plain (form submission attack)", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          origin: ORIGIN,
        },
        body: "{}",
      });
      expect(res.status).toBe(403);
    });

    it("should reject multipart/form-data (form submission attack)", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data",
          origin: ORIGIN,
        },
        body: "{}",
      });
      expect(res.status).toBe(403);
    });

    it("should reject application/x-www-form-urlencoded", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: ORIGIN,
        },
        body: "a=b",
      });
      expect(res.status).toBe(403);
    });

    it("should reject empty Content-Type header", async () => {
      const res = await app.request("/test", {
        method: "POST",
        headers: {
          "content-type": "",
          origin: ORIGIN,
        },
      });
      expect(res.status).toBe(403);
    });
  });
});
