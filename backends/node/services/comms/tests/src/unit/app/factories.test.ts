import { describe, it, expect } from "vitest";
import { createDeliveryHandlers } from "@d2/comms-app";
import {
  createMockContext,
  createMockMessageRepo,
  createMockRequestRepo,
  createMockAttemptRepo,
  createMockChannelPrefRepo,
  createMockEmailProvider,
  createMockGetContactsByIds,
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
        },
        { email: createMockEmailProvider() },
        createMockGetContactsByIds() as any,
        createMockContext(),
      );

      expect(handlers.deliver).toBeDefined();
      expect(handlers.resolveRecipient).toBeDefined();
      expect(handlers.setChannelPreference).toBeDefined();
      expect(handlers.getChannelPreference).toBeDefined();
    });
  });
});
