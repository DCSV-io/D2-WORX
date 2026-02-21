import { describe, it, expect, beforeEach, vi } from "vitest";
import { D2Result } from "@d2/result";
import { Deliver } from "@d2/comms-app";
import { RecipientResolver } from "@d2/comms-app";
import {
  createMockContext,
  createMockMessageRepo,
  createMockRequestRepo,
  createMockAttemptRepo,
  createMockChannelPrefRepo,
  createMockTemplateRepo,
  createMockEmailProvider,
  createMockGetContactsByExtKeys,
} from "../helpers/mock-handlers.js";

describe("Deliver", () => {
  let deliver: Deliver;
  let messageRepo: ReturnType<typeof createMockMessageRepo>;
  let requestRepo: ReturnType<typeof createMockRequestRepo>;
  let attemptRepo: ReturnType<typeof createMockAttemptRepo>;
  let channelPrefRepo: ReturnType<typeof createMockChannelPrefRepo>;
  let templateRepo: ReturnType<typeof createMockTemplateRepo>;
  let emailProvider: ReturnType<typeof createMockEmailProvider>;
  let recipientResolver: RecipientResolver;

  beforeEach(() => {
    const context = createMockContext();
    messageRepo = createMockMessageRepo();
    requestRepo = createMockRequestRepo();
    attemptRepo = createMockAttemptRepo();
    channelPrefRepo = createMockChannelPrefRepo();
    templateRepo = createMockTemplateRepo();
    emailProvider = createMockEmailProvider();

    const geoHandler = createMockGetContactsByExtKeys();
    recipientResolver = new RecipientResolver(geoHandler as any, context);

    deliver = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
        template: templateRepo,
      },
      { email: emailProvider },
      recipientResolver,
      context,
    );
  });

  it("should deliver email successfully", async () => {
    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test Email",
      content: "<p>Hello</p>",
      plainTextContent: "Hello",
      sensitive: true,
      recipientUserId: "user-123",
      channels: ["email"],
      correlationId: "corr-1",
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.messageId).toBeDefined();
    expect(result.data!.requestId).toBeDefined();
    expect(result.data!.attempts).toHaveLength(1);
    expect(result.data!.attempts[0].status).toBe("sent");
    expect(result.data!.attempts[0].recipientAddress).toBe("user@example.com");
    expect(result.data!.attempts[0].providerMessageId).toBe("resend-msg-123");
  });

  it("should return existing result for duplicate correlationId", async () => {
    // Mock findByCorrelationId returning an existing request
    (requestRepo.findByCorrelationId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({
        data: {
          request: {
            id: "existing-req",
            messageId: "existing-msg",
            correlationId: "corr-dup",
            recipientUserId: "user-123",
            recipientContactId: null,
            channels: ["email"],
            templateName: null,
            callbackTopic: null,
            createdAt: new Date(),
            processedAt: null,
          },
        },
      }),
    );

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-123",
      correlationId: "corr-dup",
    });

    expect(result.success).toBe(true);
    expect(result.data!.requestId).toBe("existing-req");
    // Should NOT create new message or request
    expect(messageRepo.create.handleAsync).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when no deliverable address", async () => {
    // Mock geo returning empty contacts
    const emptyGeo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };
    const context = createMockContext();
    const resolver = new RecipientResolver(emptyGeo as any, context);
    const deliverNoAddr = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
        template: templateRepo,
      },
      { email: emailProvider },
      resolver,
      context,
    );

    const result = await deliverNoAddr.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-999",
      channels: ["email"],
      correlationId: "corr-no-addr",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
  });

  it("should handle email send failure gracefully", async () => {
    (emailProvider.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.fail({ messages: ["SMTP timeout"], statusCode: 502 }),
    );

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      sensitive: true,
      recipientUserId: "user-123",
      channels: ["email"],
      correlationId: "corr-fail",
    });

    expect(result.success).toBe(true);
    expect(result.data!.attempts).toHaveLength(1);
    expect(result.data!.attempts[0].status).toBe("failed");
    expect(result.data!.attempts[0].error).toBe("SMTP timeout");
  });

  it("should persist message and delivery request", async () => {
    await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-123",
      channels: ["email"],
      correlationId: "corr-persist",
    });

    expect(messageRepo.create.handleAsync).toHaveBeenCalledOnce();
    expect(requestRepo.create.handleAsync).toHaveBeenCalledOnce();
    expect(attemptRepo.create.handleAsync).toHaveBeenCalledOnce();
  });
});
