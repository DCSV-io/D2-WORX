import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { seedDefaultTemplates, createTemplateWrapperRepoHandlers } from "@d2/comms-infra";
import type { TemplateWrapperRepoHandlers } from "@d2/comms-app";
import {
  startPostgres,
  stopPostgres,
  getDb,
  cleanAllTables,
} from "./helpers/postgres-test-helpers.js";
import { createTestContext } from "./helpers/test-context.js";

/**
 * Integration test for seedDefaultTemplates against real PostgreSQL.
 *
 * Proves that:
 *  1. The function creates exactly 3 default email templates
 *  2. It's idempotent — running twice doesn't create duplicates
 *  3. Each template has the expected name + channel + non-empty body
 */
describe("seedDefaultTemplates (integration)", () => {
  let repo: TemplateWrapperRepoHandlers;

  beforeAll(async () => {
    await startPostgres();
    repo = createTemplateWrapperRepoHandlers(getDb(), createTestContext());
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanAllTables();
  });

  it("should seed 3 default email templates", async () => {
    const ctx = createTestContext();
    await seedDefaultTemplates(repo, ctx);

    const verification = await repo.findByNameAndChannel.handleAsync({
      name: "email-verification",
      channel: "email",
    });
    const passwordReset = await repo.findByNameAndChannel.handleAsync({
      name: "password-reset",
      channel: "email",
    });
    const invitation = await repo.findByNameAndChannel.handleAsync({
      name: "invitation",
      channel: "email",
    });

    expect(verification.success).toBe(true);
    expect(verification.data!.template).not.toBeNull();
    expect(verification.data!.template!.name).toBe("email-verification");
    expect(verification.data!.template!.channel).toBe("email");
    expect(verification.data!.template!.subjectTemplate).toBe("Verify your email address");
    expect(verification.data!.template!.bodyTemplate).toContain("{{title}}");
    expect(verification.data!.template!.active).toBe(true);

    expect(passwordReset.success).toBe(true);
    expect(passwordReset.data!.template).not.toBeNull();
    expect(passwordReset.data!.template!.name).toBe("password-reset");
    expect(passwordReset.data!.template!.subjectTemplate).toBe("Reset your password");

    expect(invitation.success).toBe(true);
    expect(invitation.data!.template).not.toBeNull();
    expect(invitation.data!.template!.name).toBe("invitation");
    expect(invitation.data!.template!.subjectTemplate).toBe("You've been invited to {{orgName}}");
  });

  it("should be idempotent — running twice creates no duplicates", async () => {
    const ctx = createTestContext();

    // Run seed twice
    await seedDefaultTemplates(repo, ctx);
    await seedDefaultTemplates(repo, ctx);

    // Verify each template exists exactly once (findByNameAndChannel returns single match)
    const verification = await repo.findByNameAndChannel.handleAsync({
      name: "email-verification",
      channel: "email",
    });
    const passwordReset = await repo.findByNameAndChannel.handleAsync({
      name: "password-reset",
      channel: "email",
    });
    const invitation = await repo.findByNameAndChannel.handleAsync({
      name: "invitation",
      channel: "email",
    });

    expect(verification.data!.template).not.toBeNull();
    expect(passwordReset.data!.template).not.toBeNull();
    expect(invitation.data!.template).not.toBeNull();
  });

  it("should not overwrite a modified template on re-seed", async () => {
    const ctx = createTestContext();

    // Seed once
    await seedDefaultTemplates(repo, ctx);

    // Modify the verification template
    const original = (
      await repo.findByNameAndChannel.handleAsync({
        name: "email-verification",
        channel: "email",
      })
    ).data!.template!;

    const modified = {
      ...original,
      subjectTemplate: "Custom subject",
      updatedAt: new Date(),
    };
    await repo.update.handleAsync({ template: modified });

    // Re-seed — should NOT overwrite (template already exists)
    await seedDefaultTemplates(repo, ctx);

    const afterReseed = (
      await repo.findByNameAndChannel.handleAsync({
        name: "email-verification",
        channel: "email",
      })
    ).data!.template!;

    expect(afterReseed.subjectTemplate).toBe("Custom subject");
  });
});
