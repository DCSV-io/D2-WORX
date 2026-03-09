import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";
import type { RequestEnrichment } from "@d2/interfaces";

const mockResolve = vi.fn();

vi.mock("../auth.server", () => ({
  getAuthContext: () => ({
    sessionResolver: { resolve: mockResolve },
  }),
}));

import { createAuthHandle } from "./auth.server";

describe("createAuthHandle", () => {
  const handle = createAuthHandle();

  function makeEvent(
    requestInfo?: Partial<RequestEnrichment.IRequestInfo>,
  ): RequestEvent {
    return {
      request: new Request("http://localhost/test"),
      locals: {
        session: null,
        user: null,
        requestInfo: requestInfo
          ? ({
              clientIp: "127.0.0.1",
              serverFingerprint: "abc",
              deviceFingerprint: "abc123def456",
              isAuthenticated: false,
              isTrustedService: false,
              userId: undefined,
              ...requestInfo,
            } as RequestEnrichment.IRequestInfo)
          : undefined,
      },
    } as unknown as RequestEvent;
  }

  const mockSvelteResolve = vi.fn().mockResolvedValue(new Response("OK"));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets session and user on locals from resolver", async () => {
    const session = { userId: "user-1" };
    const user = { id: "user-1", email: "test@example.com" };
    mockResolve.mockResolvedValue({ session, user });

    const event = makeEvent();
    await handle({ event, resolve: mockSvelteResolve });

    expect(event.locals.session).toBe(session);
    expect(event.locals.user).toBe(user);
  });

  it("sets null session and user when resolver returns nulls", async () => {
    mockResolve.mockResolvedValue({ session: null, user: null });

    const event = makeEvent();
    await handle({ event, resolve: mockSvelteResolve });

    expect(event.locals.session).toBeNull();
    expect(event.locals.user).toBeNull();
  });

  it("updates requestInfo.isAuthenticated and userId when session exists", async () => {
    const session = { userId: "user-abc-123" };
    const user = { id: "user-abc-123" };
    mockResolve.mockResolvedValue({ session, user });

    const event = makeEvent({ isAuthenticated: false, userId: undefined });
    await handle({ event, resolve: mockSvelteResolve });

    expect(event.locals.requestInfo!.isAuthenticated).toBe(true);
    expect(event.locals.requestInfo!.userId).toBe("user-abc-123");
  });

  it("does NOT update requestInfo when session is null", async () => {
    mockResolve.mockResolvedValue({ session: null, user: null });

    const event = makeEvent({ isAuthenticated: false, userId: undefined });
    await handle({ event, resolve: mockSvelteResolve });

    expect(event.locals.requestInfo!.isAuthenticated).toBe(false);
    expect(event.locals.requestInfo!.userId).toBeUndefined();
  });

  it("does NOT crash when requestInfo is undefined", async () => {
    const session = { userId: "user-1" };
    mockResolve.mockResolvedValue({ session, user: { id: "user-1" } });

    const event = makeEvent(); // no requestInfo
    await handle({ event, resolve: mockSvelteResolve });

    expect(event.locals.session).toBe(session);
    expect(event.locals.requestInfo).toBeUndefined();
  });

  it("calls resolve with the event", async () => {
    mockResolve.mockResolvedValue({ session: null, user: null });

    const event = makeEvent();
    await handle({ event, resolve: mockSvelteResolve });

    expect(mockSvelteResolve).toHaveBeenCalledWith(event);
  });
});
