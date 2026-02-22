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
  createMockGetContactsByIds,
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
    const geoByIdHandler = createMockGetContactsByIds();
    recipientResolver = new RecipientResolver(geoHandler as any, geoByIdHandler as any, context);

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
    const emptyGeoById = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };
    const context = createMockContext();
    const resolver = new RecipientResolver(emptyGeo as any, emptyGeoById as any, context);
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

  it("should leave SMS attempt as pending when smsProvider is undefined", async () => {
    // Default Deliver has no SMS provider — only email
    // Mock geo to return a contact with phone
    const contactsWithPhone = new Map();
    contactsWithPhone.set("auth_user:user-sms", [
      {
        id: "c-sms",
        contextKey: "auth_user",
        relatedEntityId: "user-sms",
        contactMethods: {
          emails: [],
          phoneNumbers: [{ value: "+15551234567", labels: [] }],
        },
        personalDetails: undefined,
        professionalDetails: undefined,
        location: undefined,
        createdAt: new Date(),
      },
    ]);

    const geoWithPhone = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contactsWithPhone } })),
    };
    const geoByIdEmpty = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };

    const context = createMockContext();
    const resolverSms = new RecipientResolver(geoWithPhone as any, geoByIdEmpty as any, context);

    const smsDeliver = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
        template: templateRepo,
      },
      { email: emailProvider }, // No sms provider
      resolverSms,
      context,
    );

    const result = await smsDeliver.handleAsync({
      senderService: "auth",
      title: "SMS Test",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-sms",
      channels: ["sms"],
      correlationId: "corr-sms-no-provider",
    });

    expect(result.success).toBe(true);
    expect(result.data!.attempts).toHaveLength(1);
    // Without an SMS provider, the attempt stays "pending" (no dispatch code runs)
    expect(result.data!.attempts[0].status).toBe("pending");
    expect(result.data!.attempts[0].channel).toBe("sms");
  });

  it("should look up channel prefs by contactId when recipientContactId is provided", async () => {
    const contactMap = new Map();
    contactMap.set("contact-pref", {
      id: "contact-pref",
      contextKey: "auth_org_invitation",
      relatedEntityId: "inv-1",
      contactMethods: {
        emails: [{ value: "pref@example.com", labels: [] }],
        phoneNumbers: [],
      },
      personalDetails: undefined,
      professionalDetails: undefined,
      location: undefined,
      createdAt: new Date(),
    });

    const geoEmpty = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };
    const geoById = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contactMap } })),
    };

    const context = createMockContext();
    const resolverContact = new RecipientResolver(geoEmpty as any, geoById as any, context);

    const contactDeliver = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
        template: templateRepo,
      },
      { email: emailProvider },
      resolverContact,
      context,
    );

    await contactDeliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientContactId: "contact-pref",
      channels: ["email"],
      correlationId: "corr-contact-pref",
    });

    // Should call findByContactId, not findByUserId
    expect(channelPrefRepo.findByContactId.handleAsync).toHaveBeenCalledWith({
      contactId: "contact-pref",
    });
    expect(channelPrefRepo.findByUserId.handleAsync).not.toHaveBeenCalled();
  });

  it("should not look up channel prefs when neither userId nor contactId given", async () => {
    // This path results in NOT_FOUND because there's no recipient to resolve
    const geoEmpty = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };
    const geoByIdEmpty = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };

    const context = createMockContext();
    const resolverEmpty = new RecipientResolver(geoEmpty as any, geoByIdEmpty as any, context);

    const noRecipientDeliver = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
        template: templateRepo,
      },
      { email: emailProvider },
      resolverEmpty,
      context,
    );

    // No recipient IDs → resolver returns empty → no deliverable address
    const result = await noRecipientDeliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      channels: ["email"],
      correlationId: "corr-no-recipient",
    });

    expect(result.success).toBe(false);
    expect(channelPrefRepo.findByUserId.handleAsync).not.toHaveBeenCalled();
    expect(channelPrefRepo.findByContactId.handleAsync).not.toHaveBeenCalled();
  });
});
