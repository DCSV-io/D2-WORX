import { describe, it, expect } from "vitest";
import { createDeliveryHandlers, createDeliverySubHandlers } from "@d2/comms-app";
import {
  createMockContext,
  createMockMessageRepo,
  createMockRequestRepo,
  createMockAttemptRepo,
  createMockChannelPrefRepo,
  createMockTemplateRepo,
  createMockEmailProvider,
  createMockGetContactsByExtKeys,
} from "./helpers/mock-handlers.js";

describe("Factory Functions", () => {
  describe("createDeliveryHandlers", () => {
    it("should create all delivery handlers", () => {
      const handlers = createDeliveryHandlers(
        {
          message: createMockMessageRepo(),
          request: createMockRequestRepo(),
          attempt: createMockAttemptRepo(),
          channelPref: createMockChannelPrefRepo(),
          template: createMockTemplateRepo(),
        },
        { email: createMockEmailProvider() },
        createMockGetContactsByExtKeys() as any,
        createMockContext(),
      );

      expect(handlers.deliver).toBeDefined();
      expect(handlers.resolveRecipient).toBeDefined();
      expect(handlers.setChannelPreference).toBeDefined();
      expect(handlers.getChannelPreference).toBeDefined();
      expect(handlers.upsertTemplate).toBeDefined();
      expect(handlers.getTemplate).toBeDefined();
    });
  });

  describe("createDeliverySubHandlers", () => {
    it("should create all sub handlers", () => {
      const handlers = createDeliveryHandlers(
        {
          message: createMockMessageRepo(),
          request: createMockRequestRepo(),
          attempt: createMockAttemptRepo(),
          channelPref: createMockChannelPrefRepo(),
          template: createMockTemplateRepo(),
        },
        { email: createMockEmailProvider() },
        createMockGetContactsByExtKeys() as any,
        createMockContext(),
      );

      const subHandlers = createDeliverySubHandlers(handlers.deliver, createMockContext());

      expect(subHandlers.handleVerificationEmail).toBeDefined();
      expect(subHandlers.handlePasswordReset).toBeDefined();
    });
  });
});
