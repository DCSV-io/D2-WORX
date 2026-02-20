import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { GetTemplate } from "@d2/comms-app";
import { createTemplateWrapper } from "@d2/comms-domain";
import {
  createMockContext,
  createMockTemplateRepo,
} from "../helpers/mock-handlers.js";

function createMockCache() {
  return {
    get: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })) },
    set: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })) },
  };
}

describe("GetTemplate", () => {
  it("should fetch template from repo when no cache", async () => {
    const template = createTemplateWrapper({
      name: "welcome",
      channel: "email",
      bodyTemplate: "<html>hi</html>",
    });
    const repo = createMockTemplateRepo();
    (repo.findByNameAndChannel.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { template } }),
    );

    const handler = new GetTemplate(repo, createMockContext());
    const result = await handler.handleAsync({ name: "welcome", channel: "email" });

    expect(result.success).toBe(true);
    expect(result.data!.template).toEqual(template);
  });

  it("should return null when template not found", async () => {
    const repo = createMockTemplateRepo();
    const handler = new GetTemplate(repo, createMockContext());

    const result = await handler.handleAsync({ name: "nonexistent", channel: "sms" });

    expect(result.success).toBe(true);
    expect(result.data!.template).toBeNull();
  });

  it("should return cached value on cache hit", async () => {
    const template = createTemplateWrapper({
      name: "cached",
      channel: "email",
      bodyTemplate: "<html>cached</html>",
    });
    const cache = createMockCache();
    (cache.get.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { value: template } }),
    );

    const repo = createMockTemplateRepo();
    const handler = new GetTemplate(repo, createMockContext(), cache as any);
    const result = await handler.handleAsync({ name: "cached", channel: "email" });

    expect(result.success).toBe(true);
    expect(result.data!.template).toEqual(template);
    expect(repo.findByNameAndChannel.handleAsync).not.toHaveBeenCalled();
  });

  it("should populate cache on miss with 30min TTL", async () => {
    const template = createTemplateWrapper({
      name: "miss",
      channel: "email",
      bodyTemplate: "<html>miss</html>",
    });
    const cache = createMockCache();
    const repo = createMockTemplateRepo();
    (repo.findByNameAndChannel.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { template } }),
    );

    const handler = new GetTemplate(repo, createMockContext(), cache as any);
    await handler.handleAsync({ name: "miss", channel: "email" });

    expect(cache.set.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "template:miss:email",
        value: template,
        expirationMs: 1_800_000,
      }),
    );
  });

  it("should not populate cache when template is null", async () => {
    const cache = createMockCache();
    const repo = createMockTemplateRepo();

    const handler = new GetTemplate(repo, createMockContext(), cache as any);
    await handler.handleAsync({ name: "nope", channel: "email" });

    expect(cache.set.handleAsync).not.toHaveBeenCalled();
  });

  it("should use correct cache key format", async () => {
    const cache = createMockCache();
    const repo = createMockTemplateRepo();

    const handler = new GetTemplate(repo, createMockContext(), cache as any);
    await handler.handleAsync({ name: "password-reset", channel: "sms" });

    expect(cache.get.handleAsync).toHaveBeenCalledWith({ key: "template:password-reset:sms" });
  });

  it("should handle repo failure gracefully", async () => {
    const repo = createMockTemplateRepo();
    (repo.findByNameAndChannel.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.fail({ messages: ["DB error"] }),
    );

    const handler = new GetTemplate(repo, createMockContext());
    const result = await handler.handleAsync({ name: "test", channel: "email" });

    expect(result.success).toBe(true);
    expect(result.data!.template).toBeNull();
  });
});
