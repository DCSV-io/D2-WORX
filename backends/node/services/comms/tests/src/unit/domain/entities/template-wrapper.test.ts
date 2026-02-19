import { describe, it, expect } from "vitest";
import {
  createTemplateWrapper,
  updateTemplateWrapper,
  CommsValidationError,
} from "@d2/comms-domain";

describe("TemplateWrapper", () => {
  const validInput = {
    name: "transactional",
    channel: "email" as const,
    bodyTemplate: "<html>{{body}}</html>",
  };

  describe("createTemplateWrapper", () => {
    it("should create a template with valid input", () => {
      const tpl = createTemplateWrapper(validInput);
      expect(tpl.name).toBe("transactional");
      expect(tpl.channel).toBe("email");
      expect(tpl.bodyTemplate).toBe("<html>{{body}}</html>");
      expect(tpl.active).toBe(true);
      expect(tpl.subjectTemplate).toBeNull();
      expect(tpl.id).toHaveLength(36);
    });

    it("should accept subject template", () => {
      const tpl = createTemplateWrapper({
        ...validInput,
        subjectTemplate: "{{title}} - D2-WORX",
      });
      expect(tpl.subjectTemplate).toBe("{{title}} - D2-WORX");
    });

    it("should accept active flag", () => {
      const tpl = createTemplateWrapper({ ...validInput, active: false });
      expect(tpl.active).toBe(false);
    });

    it("should accept sms channel", () => {
      const tpl = createTemplateWrapper({
        name: "sms-notify",
        channel: "sms",
        bodyTemplate: "D2-WORX: {{body}}",
      });
      expect(tpl.channel).toBe("sms");
    });

    it("should clean and trim name", () => {
      const tpl = createTemplateWrapper({ ...validInput, name: "  my template  " });
      expect(tpl.name).toBe("my template");
    });

    it("should throw when name is empty", () => {
      expect(() =>
        createTemplateWrapper({ ...validInput, name: "" }),
      ).toThrow(CommsValidationError);
    });

    it("should throw when bodyTemplate is empty", () => {
      expect(() =>
        createTemplateWrapper({ ...validInput, bodyTemplate: "" }),
      ).toThrow(CommsValidationError);
    });

    it("should throw when channel is invalid", () => {
      expect(() =>
        createTemplateWrapper({ ...validInput, channel: "push" as never }),
      ).toThrow(CommsValidationError);
    });
  });

  describe("updateTemplateWrapper", () => {
    const baseTpl = createTemplateWrapper(validInput);

    it("should update name", () => {
      const updated = updateTemplateWrapper(baseTpl, { name: "notification" });
      expect(updated.name).toBe("notification");
    });

    it("should update bodyTemplate", () => {
      const updated = updateTemplateWrapper(baseTpl, { bodyTemplate: "<div>{{body}}</div>" });
      expect(updated.bodyTemplate).toBe("<div>{{body}}</div>");
    });

    it("should update active flag", () => {
      const updated = updateTemplateWrapper(baseTpl, { active: false });
      expect(updated.active).toBe(false);
    });

    it("should update subjectTemplate", () => {
      const updated = updateTemplateWrapper(baseTpl, { subjectTemplate: "New Subject" });
      expect(updated.subjectTemplate).toBe("New Subject");
    });

    it("should preserve unchanged fields", () => {
      const updated = updateTemplateWrapper(baseTpl, { active: false });
      expect(updated.name).toBe(baseTpl.name);
      expect(updated.channel).toBe(baseTpl.channel);
      expect(updated.bodyTemplate).toBe(baseTpl.bodyTemplate);
    });

    it("should throw when name is updated to empty", () => {
      expect(() => updateTemplateWrapper(baseTpl, { name: "" })).toThrow(CommsValidationError);
    });

    it("should throw when bodyTemplate is updated to empty", () => {
      expect(() => updateTemplateWrapper(baseTpl, { bodyTemplate: "   " })).toThrow(
        CommsValidationError,
      );
    });

    it("should clear subjectTemplate via empty string", () => {
      const withSubject = createTemplateWrapper({
        ...validInput,
        subjectTemplate: "My Subject",
      });
      const updated = updateTemplateWrapper(withSubject, { subjectTemplate: "" });
      expect(updated.subjectTemplate).toBeNull();
    });

    it("should preserve channel on update (immutable)", () => {
      const updated = updateTemplateWrapper(baseTpl, { name: "new-name" });
      expect(updated.channel).toBe(baseTpl.channel);
    });

    it("should update updatedAt", () => {
      const updated = updateTemplateWrapper(baseTpl, { name: "new-name" });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(baseTpl.updatedAt.getTime());
    });

    it("should accept templates with placeholder patterns", () => {
      const updated = updateTemplateWrapper(baseTpl, {
        bodyTemplate: "<div>{{title}}</div><div>{{body}}</div>",
      });
      expect(updated.bodyTemplate).toBe("<div>{{title}}</div><div>{{body}}</div>");
    });
  });
});
