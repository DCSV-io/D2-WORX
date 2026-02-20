import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { generateUuidV7 } from "@d2/utilities";
import {
  createTemplateWrapper,
  updateTemplateWrapper,
  type TemplateWrapper,
} from "@d2/comms-domain";
import { createTemplateWrapperRepoHandlers } from "@d2/comms-infra";
import type { TemplateWrapperRepoHandlers } from "@d2/comms-app";
import {
  startPostgres,
  stopPostgres,
  getDb,
  cleanAllTables,
} from "./helpers/postgres-test-helpers.js";
import { createTestContext } from "./helpers/test-context.js";

describe("TemplateWrapperRepository (integration)", () => {
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

  function makeTemplate(overrides?: Partial<TemplateWrapper>): TemplateWrapper {
    const base = createTemplateWrapper({
      name: "welcome-email",
      channel: "email",
      bodyTemplate: "<p>Welcome {{name}}</p>",
      subjectTemplate: "Welcome to D2-WORX",
    });
    return overrides ? { ...base, ...overrides } : base;
  }

  it("should create and find by name and channel", async () => {
    const tpl = makeTemplate();
    const createResult = await repo.create.handleAsync({ template: tpl });
    expect(createResult.success).toBe(true);

    const findResult = await repo.findByNameAndChannel.handleAsync({
      name: "welcome-email",
      channel: "email",
    });
    expect(findResult.success).toBe(true);

    const found = findResult.data!.template!;
    expect(found.id).toBe(tpl.id);
    expect(found.name).toBe("welcome-email");
    expect(found.channel).toBe("email");
    expect(found.bodyTemplate).toBe("<p>Welcome {{name}}</p>");
    expect(found.subjectTemplate).toBe("Welcome to D2-WORX");
    expect(found.active).toBe(true);
    expect(found.createdAt).toBeInstanceOf(Date);
    expect(found.updatedAt).toBeInstanceOf(Date);
  });

  it("should return null when name+channel not found", async () => {
    const result = await repo.findByNameAndChannel.handleAsync({
      name: "nonexistent",
      channel: "email",
    });
    expect(result.success).toBe(true);
    expect(result.data!.template).toBeNull();
  });

  it("should update name, body, subject, and active", async () => {
    const tpl = makeTemplate();
    await repo.create.handleAsync({ template: tpl });

    const updated = updateTemplateWrapper(tpl, {
      name: "updated-email",
      bodyTemplate: "<p>Updated {{name}}</p>",
      subjectTemplate: "Updated Subject",
      active: false,
    });
    await repo.update.handleAsync({ template: updated });

    // Find by NEW name (name was changed)
    const result = await repo.findByNameAndChannel.handleAsync({
      name: "updated-email",
      channel: "email",
    });
    const found = result.data!.template!;
    expect(found.name).toBe("updated-email");
    expect(found.bodyTemplate).toBe("<p>Updated {{name}}</p>");
    expect(found.subjectTemplate).toBe("Updated Subject");
    expect(found.active).toBe(false);
  });

  it("should enforce unique constraint on (name, channel)", async () => {
    const tpl1 = makeTemplate();
    const tpl2 = makeTemplate({ id: generateUuidV7() });

    await repo.create.handleAsync({ template: tpl1 });
    const result = await repo.create.handleAsync({ template: tpl2 });
    expect(result.success).toBe(false);
  });

  it("should allow same name on different channels", async () => {
    const emailTpl = makeTemplate();
    const smsTpl = makeTemplate({
      id: generateUuidV7(),
      channel: "sms",
      subjectTemplate: null,
      bodyTemplate: "Welcome {{name}}",
    });

    const result1 = await repo.create.handleAsync({ template: emailTpl });
    const result2 = await repo.create.handleAsync({ template: smsTpl });
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Verify each retrieves correctly
    const emailResult = await repo.findByNameAndChannel.handleAsync({
      name: "welcome-email",
      channel: "email",
    });
    const smsResult = await repo.findByNameAndChannel.handleAsync({
      name: "welcome-email",
      channel: "sms",
    });
    expect(emailResult.data!.template!.channel).toBe("email");
    expect(smsResult.data!.template!.channel).toBe("sms");
  });

  it("should store null subjectTemplate", async () => {
    const tpl = makeTemplate({
      channel: "sms",
      subjectTemplate: null,
      bodyTemplate: "SMS body {{name}}",
    });
    await repo.create.handleAsync({ template: tpl });

    const result = await repo.findByNameAndChannel.handleAsync({
      name: "welcome-email",
      channel: "sms",
    });
    expect(result.data!.template!.subjectTemplate).toBeNull();
  });
});
