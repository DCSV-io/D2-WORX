import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthProxy } from "../auth-proxy.js";
import type { AuthBffConfig } from "../types.js";
import type { ILogger } from "@d2/logging";
import type { RequestEvent } from "@sveltejs/kit";

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

function makeEvent(
  method: string,
  path: string,
  headers?: Record<string, string>,
  body?: string,
): RequestEvent {
  const requestHeaders = new Headers(headers);
  const request = new Request(`http://localhost:5173${path}`, {
    method,
    headers: requestHeaders,
    body: method !== "GET" && method !== "HEAD" ? body : undefined,
  });

  return {
    request,
    url: new URL(`http://localhost:5173${path}`),
    locals: {},
  } as unknown as RequestEvent;
}

describe("AuthProxy", () => {
  let proxy: AuthProxy;
  let logger: ILogger;

  beforeEach(() => {
    logger = createSilentLogger();
    proxy = new AuthProxy(config, logger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should proxy GET request with correct headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const event = makeEvent("GET", "/api/auth/get-session", {
      cookie: "session_token=abc",
      "user-agent": "Mozilla/5.0",
    });

    const response = await proxy.proxyRequest(event);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:5100/api/auth/get-session");
    expect(init.method).toBe("GET");
    expect(init.headers.get("cookie")).toBe("session_token=abc");
    expect(init.headers.get("user-agent")).toBe("Mozilla/5.0");
  });

  it("should proxy POST request with body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const event = makeEvent(
      "POST",
      "/api/auth/sign-in/email",
      {
        "content-type": "application/json",
        cookie: "csrf_token=xyz",
      },
      JSON.stringify({ email: "test@example.com", password: "pass123" }),
    );

    const response = await proxy.proxyRequest(event);

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:5100/api/auth/sign-in/email");
    expect(init.method).toBe("POST");
    expect(init.headers.get("content-type")).toBe("application/json");
  });

  it("should preserve set-cookie headers in response", async () => {
    const responseHeaders = new Headers();
    responseHeaders.append("set-cookie", "better-auth.session_token=new-token; HttpOnly; Path=/");
    responseHeaders.append("content-type", "application/json");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: responseHeaders,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const event = makeEvent("POST", "/api/auth/sign-in/email", {
      cookie: "old_token=abc",
    });

    const response = await proxy.proxyRequest(event);

    expect(response.headers.get("set-cookie")).toContain("better-auth.session_token=new-token");
  });

  it("should return 503 on auth service timeout/network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const event = makeEvent("GET", "/api/auth/get-session", {
      cookie: "session_token=abc",
    });

    const response = await proxy.proxyRequest(event);

    expect(response.status).toBe(503);
    const body = (await response.json()) as { errorCode: string };
    expect(body.errorCode).toBe("AUTH_UNAVAILABLE");
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("should forward query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const event = makeEvent("GET", "/api/auth/callback?code=abc&state=xyz", {
      cookie: "session_token=abc",
    });

    await proxy.proxyRequest(event);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:5100/api/auth/callback?code=abc&state=xyz");
  });
});
