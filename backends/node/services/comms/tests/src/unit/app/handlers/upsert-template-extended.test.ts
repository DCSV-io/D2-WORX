import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { UpsertTemplate } from "@d2/comms-app";
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

describe("UpsertTemplate — extended coverage", () => {
  it("should populate cache after creating template", async () => {
    const cache = createMockCache();
    const repo = createMockTemplateRepo();
    const handler = new UpsertTemplate(repo, createMockContext(), cache as any);

    const result = await handler.handleAsync({
      name: "test-tpl",
      channel: "email",
      bodyTemplate: "<html>{{body}}</html>",
    });

    expect(result.success).toBe(true);
    expect(cache.set.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "template:test-tpl:email",
        expirationMs: 1_800_000,
      }),
    );
  });

  it("should populate cache after updating template", async () => {
    const existing = createTemplateWrapper({
      name: "update-tpl",
      channel: "email",
      bodyTemplate: "<html>old</html>",
    });
    const cache = createMockCache();
    const repo = createMockTemplateRepo();
    (repo.findByNameAndChannel.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { template: existing } }),
    );

    const handler = new UpsertTemplate(repo, createMockContext(), cache as any);
    await handler.handleAsync({
      name: "update-tpl",
      channel: "email",
      bodyTemplate: "<html>new</html>",
    });

    expect(cache.set.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "template:update-tpl:email",
      }),
    );
  });

  it("should not call cache when cache not provided", async () => {
    const repo = createMockTemplateRepo();
    const handler = new UpsertTemplate(repo, createMockContext());

    const result = await handler.handleAsync({
      name: "no-cache",
      channel: "email",
      bodyTemplate: "<html>test</html>",
    });

    expect(result.success).toBe(true);
    // No cache calls
  });

  it("should accept sms channel", async () => {
    const repo = createMockTemplateRepo();
    const handler = new UpsertTemplate(repo, createMockContext());

    const result = await handler.handleAsync({
      name: "sms-tpl",
      channel: "sms",
      bodyTemplate: "Your code is {{body}}",
    });

    expect(result.success).toBe(true);
    expect(result.data!.template.channel).toBe("sms");
  });

  it("should accept optional subjectTemplate", async () => {
    const repo = createMockTemplateRepo();
    const handler = new UpsertTemplate(repo, createMockContext());

    const result = await handler.handleAsync({
      name: "with-subject",
      channel: "email",
      bodyTemplate: "<html>{{body}}</html>",
      subjectTemplate: "Hello {{title}}",
    });

    expect(result.success).toBe(true);
    expect(result.data!.template.subjectTemplate).toBe("Hello {{title}}");
  });

  it("should fail validation for body exceeding max length", async () => {
    const repo = createMockTemplateRepo();
    const handler = new UpsertTemplate(repo, createMockContext());

    const result = await handler.handleAsync({
      name: "huge",
      channel: "email",
      bodyTemplate: "x".repeat(50_001),
    });

    expect(result.success).toBe(false);
  });
});
