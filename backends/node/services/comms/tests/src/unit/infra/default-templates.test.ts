import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { seedDefaultTemplates } from "@d2/comms-infra";
import {
  createMockContext,
  createMockTemplateRepo,
} from "../app/helpers/mock-handlers.js";

describe("seedDefaultTemplates", () => {
  it("should create 3 default templates when none exist", async () => {
    const repo = createMockTemplateRepo();
    await seedDefaultTemplates(repo, createMockContext());

    expect(repo.create.handleAsync).toHaveBeenCalledTimes(3);
  });

  it("should create email-verification, password-reset, and invitation templates", async () => {
    const repo = createMockTemplateRepo();
    await seedDefaultTemplates(repo, createMockContext());

    const calls = (repo.create.handleAsync as ReturnType<typeof vi.fn>).mock.calls;
    const names = calls.map((c: unknown[]) => (c[0] as { template: { name: string } }).template.name);

    expect(names).toContain("email-verification");
    expect(names).toContain("password-reset");
    expect(names).toContain("invitation");
  });

  it("should not overwrite existing templates", async () => {
    const repo = createMockTemplateRepo();
    // First call returns existing, rest return null
    let callCount = 0;
    (repo.findByNameAndChannel.handleAsync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          D2Result.ok({
            data: {
              template: {
                id: "existing-id",
                name: "email-verification",
                channel: "email",
                bodyTemplate: "<html>existing</html>",
                subjectTemplate: "Existing",
                active: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          }),
        );
      }
      return Promise.resolve(D2Result.ok({ data: { template: null } }));
    });

    await seedDefaultTemplates(repo, createMockContext());

    // Only 2 should be created (the first one already exists)
    expect(repo.create.handleAsync).toHaveBeenCalledTimes(2);
  });

  it("should check each template by name and channel before creating", async () => {
    const repo = createMockTemplateRepo();
    await seedDefaultTemplates(repo, createMockContext());

    expect(repo.findByNameAndChannel.handleAsync).toHaveBeenCalledTimes(3);

    const lookups = (repo.findByNameAndChannel.handleAsync as ReturnType<typeof vi.fn>).mock.calls;
    expect(lookups[0][0]).toEqual({ name: "email-verification", channel: "email" });
    expect(lookups[1][0]).toEqual({ name: "password-reset", channel: "email" });
    expect(lookups[2][0]).toEqual({ name: "invitation", channel: "email" });
  });

  it("should set all templates to email channel", async () => {
    const repo = createMockTemplateRepo();
    await seedDefaultTemplates(repo, createMockContext());

    const calls = (repo.create.handleAsync as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of calls) {
      expect((call[0] as { template: { channel: string } }).template.channel).toBe("email");
    }
  });

  it("should include subject templates for all defaults", async () => {
    const repo = createMockTemplateRepo();
    await seedDefaultTemplates(repo, createMockContext());

    const calls = (repo.create.handleAsync as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of calls) {
      const tpl = (call[0] as { template: { subjectTemplate: string | null } }).template;
      expect(tpl.subjectTemplate).toBeTruthy();
    }
  });

  it("should include HTML body templates with mustache placeholders", async () => {
    const repo = createMockTemplateRepo();
    await seedDefaultTemplates(repo, createMockContext());

    const calls = (repo.create.handleAsync as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of calls) {
      const tpl = (call[0] as { template: { bodyTemplate: string } }).template;
      expect(tpl.bodyTemplate).toContain("{{body}}");
      expect(tpl.bodyTemplate).toContain("{{title}}");
      expect(tpl.bodyTemplate).toContain("<!DOCTYPE html>");
    }
  });
});
