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
  createMockEmailProvider,
  createMockGetContactsByIds,
} from "../helpers/mock-handlers.js";

describe("Deliver", () => {
  let deliver: Deliver;
  let messageRepo: ReturnType<typeof createMockMessageRepo>;
  let requestRepo: ReturnType<typeof createMockRequestRepo>;
  let attemptRepo: ReturnType<typeof createMockAttemptRepo>;
  let channelPrefRepo: ReturnType<typeof createMockChannelPrefRepo>;
  let emailProvider: ReturnType<typeof createMockEmailProvider>;
  let recipientResolver: RecipientResolver;

  beforeEach(() => {
    const context = createMockContext();
    messageRepo = createMockMessageRepo();
    requestRepo = createMockRequestRepo();
    attemptRepo = createMockAttemptRepo();
    channelPrefRepo = createMockChannelPrefRepo();
    emailProvider = createMockEmailProvider();

    const geoByIdHandler = createMockGetContactsByIds();
    recipientResolver = new RecipientResolver(geoByIdHandler as any, context);

    deliver = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
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
      recipientContactId: "contact-1",
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
            recipientContactId: "contact-1",
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
      recipientContactId: "contact-1",
      correlationId: "corr-dup",
    });

    expect(result.success).toBe(true);
    expect(result.data!.requestId).toBe("existing-req");
    // Should NOT create new message or request
    expect(messageRepo.create.handleAsync).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when no deliverable address", async () => {
    // Mock geo returning empty contacts
    const emptyGeoById = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };
    const context = createMockContext();
    const resolver = new RecipientResolver(emptyGeoById as any, context);
    const deliverNoAddr = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
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
      recipientContactId: "contact-999",
      correlationId: "corr-no-addr",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
  });

  it("should return DELIVERY_FAILED when email send fails with retryable error", async () => {
    (emailProvider.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.fail({ messages: ["SMTP timeout"], statusCode: 502 }),
    );

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      sensitive: true,
      recipientContactId: "contact-1",
      correlationId: "corr-fail",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.errorCode).toBe("DELIVERY_FAILED");
  });

  it("should persist message and delivery request", async () => {
    await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientContactId: "contact-1",
      correlationId: "corr-persist",
    });

    expect(messageRepo.create.handleAsync).toHaveBeenCalledOnce();
    expect(requestRepo.create.handleAsync).toHaveBeenCalledOnce();
    // contact-1 has both email + phone; non-sensitive normal → 2 channels (email + sms)
    expect(attemptRepo.create.handleAsync).toHaveBeenCalledTimes(2);
  });

  it("should leave SMS attempt as pending when smsProvider is undefined", async () => {
    // Default Deliver has no SMS provider — only email
    // Mock geo to return a contact with phone
    const contactsWithPhone = new Map();
    contactsWithPhone.set("contact-sms", {
      id: "contact-sms",
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
    });

    const geoById = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contactsWithPhone } })),
    };

    const context = createMockContext();
    const resolverSms = new RecipientResolver(geoById as any, context);

    const smsDeliver = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
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
      recipientContactId: "contact-sms",
      correlationId: "corr-sms-no-provider",
    });

    expect(result.success).toBe(true);
    expect(result.data!.attempts).toHaveLength(1);
    // Without an SMS provider, the attempt stays "pending" (no dispatch code runs)
    expect(result.data!.attempts[0].status).toBe("pending");
    expect(result.data!.attempts[0].channel).toBe("sms");
  });

  it("should look up channel prefs by contactId", async () => {
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

    const geoById = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contactMap } })),
    };

    const context = createMockContext();
    const resolverContact = new RecipientResolver(geoById as any, context);

    const contactDeliver = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
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
      correlationId: "corr-contact-pref",
    });

    // Should call findByContactId
    expect(channelPrefRepo.findByContactId.handleAsync).toHaveBeenCalledWith({
      contactId: "contact-pref",
    });
  });

  // -------------------------------------------------------------------------
  // Defensive / Security tests
  // -------------------------------------------------------------------------

  it("should return 503 when recipient resolver fails entirely", async () => {
    const geoIdsFailing = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Geo down"] })),
    };

    const context = createMockContext();
    const failingResolver = new RecipientResolver(geoIdsFailing as any, context);

    const failDeliver = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
      },
      { email: emailProvider },
      failingResolver,
      context,
    );

    const result = await failDeliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientContactId: "contact-1",
      correlationId: "corr-resolver-fail",
    });

    // Resolver returns empty data → no deliverable address
    expect(result.success).toBe(false);
  });

  it("should propagate message repo failure as a fail result", async () => {
    // Override message create to fail
    (messageRepo.create.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.fail({ messages: ["DB write failed"], statusCode: 503 }),
    );

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientContactId: "contact-1",
      correlationId: "corr-msg-fail",
    });

    expect(result.success).toBe(false);
    // Should NOT attempt delivery if message creation failed
    expect(emailProvider.handleAsync).not.toHaveBeenCalled();
  });

  it("should propagate request repo failure as a fail result", async () => {
    // Override request create to fail
    (requestRepo.create.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.fail({ messages: ["DB write failed"], statusCode: 503 }),
    );

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientContactId: "contact-1",
      correlationId: "corr-req-fail",
    });

    expect(result.success).toBe(false);
    expect(emailProvider.handleAsync).not.toHaveBeenCalled();
  });

  it("should handle both email and sms channels in single request", async () => {
    // Mock geo to return contact with both email and phone
    const contactMap = new Map();
    contactMap.set("contact-dual", {
      id: "contact-dual",
      contextKey: "auth_user",
      relatedEntityId: "user-dual",
      contactMethods: {
        emails: [{ value: "dual@example.com", labels: [] }],
        phoneNumbers: [{ value: "+15551234567", labels: [] }],
      },
      personalDetails: undefined,
      professionalDetails: undefined,
      location: undefined,
      createdAt: new Date(),
    });

    const geoById = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contactMap } })),
    };

    const context = createMockContext();
    const dualResolver = new RecipientResolver(geoById as any, context);

    const mockSmsProvider = {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.ok({ data: { providerMessageId: "twilio-123" } }),
      ),
    };

    const dualDeliver = new Deliver(
      {
        message: messageRepo,
        request: requestRepo,
        attempt: attemptRepo,
        channelPref: channelPrefRepo,
      },
      { email: emailProvider, sms: mockSmsProvider as any },
      dualResolver,
      context,
    );

    const result = await dualDeliver.handleAsync({
      senderService: "auth",
      title: "Dual Channel",
      content: "test",
      plainTextContent: "test",
      recipientContactId: "contact-dual",
      correlationId: "corr-dual-channel",
    });

    expect(result.success).toBe(true);
    expect(result.data!.attempts).toHaveLength(2);
    const channels = result.data!.attempts.map((a) => a.channel);
    expect(channels).toContain("email");
    expect(channels).toContain("sms");
  });
});
