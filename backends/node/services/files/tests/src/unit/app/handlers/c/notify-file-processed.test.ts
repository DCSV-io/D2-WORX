import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { NotifyFileProcessed } from "@d2/files-app";
import type { NotifyFileProcessedInput } from "@d2/files-app";
import { createMockOutboundRequest, createMockContext } from "../../helpers/mock-handlers.js";

function createHandler(
  overrides: {
    outbound?: ReturnType<typeof createMockOutboundRequest>;
  } = {},
) {
  const outbound = overrides.outbound ?? createMockOutboundRequest();
  const context = createMockContext();

  return {
    handler: new NotifyFileProcessed(outbound, context),
    outbound,
  };
}

const validInput: NotifyFileProcessedInput = {
  url: "http://auth:3100/callbacks/file-processed",
  fileId: "file-001",
  contextKey: "user_avatar",
  relatedEntityId: "user-123",
  status: "ready",
};

describe("NotifyFileProcessed", () => {
  // --- Happy path ---

  it("should call outbound with correct payload and return success", async () => {
    const { handler, outbound } = createHandler();

    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(true);
    expect(outbound.handleAsync).toHaveBeenCalledWith({
      url: "http://auth:3100/callbacks/file-processed",
      payload: {
        fileId: "file-001",
        contextKey: "user_avatar",
        relatedEntityId: "user-123",
        status: "ready",
      },
    });
  });

  it("should include variants in payload when provided", async () => {
    const { handler, outbound } = createHandler();
    const variants = [
      {
        size: "original",
        key: "k",
        width: 100,
        height: 100,
        sizeBytes: 500,
        contentType: "image/jpeg",
      },
    ];

    const result = await handler.handleAsync({ ...validInput, variants });

    expect(result.success).toBe(true);
    expect(outbound.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ variants }),
      }),
    );
  });

  it("should omit variants from payload when not provided", async () => {
    const { handler, outbound } = createHandler();

    await handler.handleAsync(validInput);

    const call = vi.mocked(outbound.handleAsync).mock.calls[0]![0];
    expect(call.payload).not.toHaveProperty("variants");
  });

  it("should succeed with status rejected", async () => {
    const { handler } = createHandler();

    const result = await handler.handleAsync({ ...validInput, status: "rejected" });

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(true);
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

  it("should reject empty fileId", async () => {
    const { handler } = createHandler();
    const result = await handler.handleAsync({ ...validInput, fileId: "" });
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

  it("should reject invalid status value", async () => {
    const { handler } = createHandler();
    const result = await handler.handleAsync({
      ...validInput,
      status: "invalid" as "ready",
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

  it("should not call outbound on validation failure", async () => {
    const { handler, outbound } = createHandler();
    await handler.handleAsync({ ...validInput, fileId: "" });
    expect(outbound.handleAsync).not.toHaveBeenCalled();
  });
});
