import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { CheckFileAccess } from "@d2/files-app";
import type { CheckFileAccessInput } from "@d2/files-app";
import { createMockOutboundRequest, createMockContext } from "../../helpers/mock-handlers.js";

function createHandler(
  overrides: {
    outbound?: ReturnType<typeof createMockOutboundRequest>;
  } = {},
) {
  const outbound = overrides.outbound ?? createMockOutboundRequest({ allowed: true });
  const context = createMockContext();

  return {
    handler: new CheckFileAccess(outbound, context),
    outbound,
  };
}

const validInput: CheckFileAccessInput = {
  url: "http://comms:3200/callbacks/can-access",
  contextKey: "thread_attachment",
  relatedEntityId: "thread-789",
  requestingUserId: "user-123",
  requestingOrgId: "org-456",
  action: "read",
};

describe("CheckFileAccess", () => {
  // --- Happy path ---

  it("should return allowed: true when outbound responds with allowed: true", async () => {
    const { handler, outbound } = createHandler();

    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.allowed).toBe(true);
    expect(outbound.handleAsync).toHaveBeenCalledWith({
      url: "http://comms:3200/callbacks/can-access",
      payload: {
        contextKey: "thread_attachment",
        relatedEntityId: "thread-789",
        requestingUserId: "user-123",
        requestingOrgId: "org-456",
        action: "read",
      },
    });
  });

  it("should return allowed: false when outbound responds with allowed: false", async () => {
    const outbound = createMockOutboundRequest({ allowed: false });
    const { handler } = createHandler({ outbound });

    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.allowed).toBe(false);
  });

  it("should work with upload action", async () => {
    const { handler } = createHandler();

    const result = await handler.handleAsync({ ...validInput, action: "upload" });

    expect(result.success).toBe(true);
    expect(result.data?.allowed).toBe(true);
  });

  // --- Fail-closed behavior ---

  it("should return allowed: false when body is missing", async () => {
    const outbound = createMockOutboundRequest({});
    const { handler } = createHandler({ outbound });

    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.allowed).toBe(false);
  });

  it("should return allowed: false when allowed is not boolean true", async () => {
    const outbound = createMockOutboundRequest({ allowed: "yes" });
    const { handler } = createHandler({ outbound });

    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.allowed).toBe(false);
  });

  it("should return allowed: false when allowed is null", async () => {
    const outbound = createMockOutboundRequest({ allowed: null });
    const { handler } = createHandler({ outbound });

    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.allowed).toBe(false);
  });

  it("should return allowed: false when allowed is 1 (not strict boolean)", async () => {
    const outbound = createMockOutboundRequest({ allowed: 1 });
    const { handler } = createHandler({ outbound });

    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.allowed).toBe(false);
  });

  // --- Error propagation ---

  it("should propagate outbound failure via bubbleFail", async () => {
    const outbound = createMockOutboundRequest();
    vi.mocked(outbound.handleAsync).mockResolvedValue(D2Result.serviceUnavailable());
    const { handler } = createHandler({ outbound });

    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
  });

  // --- Validation errors ---

  it("should reject empty url", async () => {
    const { handler } = createHandler();
    const result = await handler.handleAsync({ ...validInput, url: "" });
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("should reject empty contextKey", async () => {
    const { handler } = createHandler();
    const result = await handler.handleAsync({ ...validInput, contextKey: "" });
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("should reject empty relatedEntityId", async () => {
    const { handler } = createHandler();
    const result = await handler.handleAsync({ ...validInput, relatedEntityId: "" });
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("should reject invalid action value", async () => {
    const { handler } = createHandler();
    const result = await handler.handleAsync({
      ...validInput,
      action: "delete" as "read",
    });
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("should reject url exceeding max length", async () => {
    const { handler } = createHandler();
    const result = await handler.handleAsync({ ...validInput, url: "x".repeat(2049) });
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("should allow empty requestingUserId (pre-auth scenario)", async () => {
    const { handler } = createHandler();
    const result = await handler.handleAsync({ ...validInput, requestingUserId: "" });
    expect(result.success).toBe(true);
  });

  it("should allow empty requestingOrgId (pre-auth scenario)", async () => {
    const { handler } = createHandler();
    const result = await handler.handleAsync({ ...validInput, requestingOrgId: "" });
    expect(result.success).toBe(true);
  });

  it("should not call outbound on validation failure", async () => {
    const { handler, outbound } = createHandler();
    await handler.handleAsync({ ...validInput, contextKey: "" });
    expect(outbound.handleAsync).not.toHaveBeenCalled();
  });
});
