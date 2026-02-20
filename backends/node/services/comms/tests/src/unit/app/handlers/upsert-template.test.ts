import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { UpsertTemplate } from "@d2/comms-app";
import { createTemplateWrapper } from "@d2/comms-domain";
import {
  createMockContext,
  createMockTemplateRepo,
} from "../helpers/mock-handlers.js";

describe("UpsertTemplate", () => {
  it("should create a new template when none exists", async () => {
    const repo = createMockTemplateRepo();
    const handler = new UpsertTemplate(repo, createMockContext());

    const result = await handler.handleAsync({
      name: "welcome",
      channel: "email",
      bodyTemplate: "<html>{{body}}</html>",
      subjectTemplate: "Welcome to {{title}}",
    });

    expect(result.success).toBe(true);
    expect(result.data!.template.name).toBe("welcome");
    expect(result.data!.template.channel).toBe("email");
    expect(repo.create.handleAsync).toHaveBeenCalledOnce();
  });

  it("should update an existing template", async () => {
    const existing = createTemplateWrapper({
      name: "welcome",
      channel: "email",
      bodyTemplate: "<html>old</html>",
    });

    const repo = createMockTemplateRepo();
    (repo.findByNameAndChannel.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { template: existing } }),
    );

    const handler = new UpsertTemplate(repo, createMockContext());

    const result = await handler.handleAsync({
      name: "welcome",
      channel: "email",
      bodyTemplate: "<html>new</html>",
    });

    expect(result.success).toBe(true);
    expect(result.data!.template.bodyTemplate).toBe("<html>new</html>");
    expect(repo.update.handleAsync).toHaveBeenCalledOnce();
  });

  it("should fail validation for empty name", async () => {
    const repo = createMockTemplateRepo();
    const handler = new UpsertTemplate(repo, createMockContext());

    const result = await handler.handleAsync({
      name: "",
      channel: "email",
      bodyTemplate: "<html>test</html>",
    });

    expect(result.success).toBe(false);
  });

  it("should fail validation for invalid channel", async () => {
    const repo = createMockTemplateRepo();
    const handler = new UpsertTemplate(repo, createMockContext());

    const result = await handler.handleAsync({
      name: "test",
      channel: "push" as any,
      bodyTemplate: "<html>test</html>",
    });

    expect(result.success).toBe(false);
  });
});
