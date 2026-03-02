import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";
import type { RequestEnrichment } from "@d2/interfaces";

const mockEnrichRequest = vi.fn();
const mockGetMiddlewareContext = vi.fn();

vi.mock("../middleware.server", () => ({
  getMiddlewareContext: (...args: unknown[]) => mockGetMiddlewareContext(...args),
  enrichRequest: (...args: unknown[]) => mockEnrichRequest(...args),
}));

import { createRequestEnrichmentHandle } from "./request-enrichment.server";

describe("createRequestEnrichmentHandle", () => {
  const handle = createRequestEnrichmentHandle();

  function makeEvent(headers?: Record<string, string>): RequestEvent {
    const h = new Headers(headers);
    return {
      request: { headers: h, method: "GET" } as unknown as Request,
      locals: {} as Record<string, unknown>,
      url: new URL("http://localhost/test"),
    } as unknown as RequestEvent;
  }

  const mockResolve = vi.fn().mockResolvedValue(new Response("OK"));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips enrichment when middleware context is null", async () => {
    mockGetMiddlewareContext.mockReturnValue(null);

    const event = makeEvent();
    await handle({ event, resolve: mockResolve });

    expect(mockResolve).toHaveBeenCalledWith(event);
    expect(mockEnrichRequest).not.toHaveBeenCalled();
    expect(event.locals.requestInfo).toBeUndefined();
  });

  it("calls enrichRequest and stores result on event.locals", async () => {
    const fakeRequestInfo: Partial<RequestEnrichment.IRequestInfo> = {
      clientIp: "1.2.3.4",
      serverFingerprint: "abc123",
      isAuthenticated: false,
      isTrustedService: false,
    };
    mockEnrichRequest.mockResolvedValue(fakeRequestInfo);

    const mockCtx = {
      findWhoIs: { handleAsync: vi.fn() },
      logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    };
    mockGetMiddlewareContext.mockReturnValue(mockCtx);

    const event = makeEvent({ "user-agent": "TestBot/1.0", "x-forwarded-for": "1.2.3.4" });
    await handle({ event, resolve: mockResolve });

    expect(mockEnrichRequest).toHaveBeenCalledWith(
      expect.objectContaining({ "user-agent": "TestBot/1.0" }),
      mockCtx.findWhoIs,
      undefined,
      mockCtx.logger,
    );
    expect(event.locals.requestInfo).toBe(fakeRequestInfo);
    expect(mockResolve).toHaveBeenCalledWith(event);
  });

  it("extracts all headers from the request", async () => {
    const fakeRequestInfo = { clientIp: "127.0.0.1" };
    mockEnrichRequest.mockResolvedValue(fakeRequestInfo);
    mockGetMiddlewareContext.mockReturnValue({
      findWhoIs: {},
      logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    });

    const event = makeEvent({
      "x-client-fingerprint": "fp-abc",
      "cf-connecting-ip": "5.6.7.8",
      "accept": "text/html",
    });

    await handle({ event, resolve: mockResolve });

    const passedHeaders = mockEnrichRequest.mock.calls[0][0];
    expect(passedHeaders["x-client-fingerprint"]).toBe("fp-abc");
    expect(passedHeaders["cf-connecting-ip"]).toBe("5.6.7.8");
    expect(passedHeaders["accept"]).toBe("text/html");
  });
});
