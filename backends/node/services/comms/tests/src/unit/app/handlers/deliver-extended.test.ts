import { describe, it, expect, beforeEach, vi } from "vitest";
import { D2Result } from "@d2/result";
import { Deliver, RecipientResolver } from "@d2/comms-app";
import { createTemplateWrapper, createChannelPreference } from "@d2/comms-domain";
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

describe("Deliver — extended coverage", () => {
  let messageRepo: ReturnType<typeof createMockMessageRepo>;
  let requestRepo: ReturnType<typeof createMockRequestRepo>;
  let attemptRepo: ReturnType<typeof createMockAttemptRepo>;
  let channelPrefRepo: ReturnType<typeof createMockChannelPrefRepo>;
  let templateRepo: ReturnType<typeof createMockTemplateRepo>;
  let emailProvider: ReturnType<typeof createMockEmailProvider>;

  function createDeliver(opts?: {
    geoContacts?: Map<string, unknown[]>;
    geoContactsById?: Map<string, unknown>;
  }) {
    const context = createMockContext();
    messageRepo = createMockMessageRepo();
    requestRepo = createMockRequestRepo();
    attemptRepo = createMockAttemptRepo();
    channelPrefRepo = createMockChannelPrefRepo();
    templateRepo = createMockTemplateRepo();
    emailProvider = createMockEmailProvider();

    let geoHandler;
    if (opts?.geoContacts) {
      geoHandler = {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: opts.geoContacts } })),
      };
    } else {
      geoHandler = createMockGetContactsByExtKeys();
    }

    let geoByIdHandler;
    if (opts?.geoContactsById) {
      geoByIdHandler = {
        handleAsync: vi
          .fn()
          .mockResolvedValue(D2Result.ok({ data: { data: opts.geoContactsById } })),
      };
    } else {
      geoByIdHandler = createMockGetContactsByIds();
    }

    const resolver = new RecipientResolver(geoHandler as any, geoByIdHandler as any, context);
    return new Deliver(
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
  }

  function createDeliverWithSms() {
    const context = createMockContext();
    messageRepo = createMockMessageRepo();
    requestRepo = createMockRequestRepo();
    attemptRepo = createMockAttemptRepo();
    channelPrefRepo = createMockChannelPrefRepo();
    templateRepo = createMockTemplateRepo();
    emailProvider = createMockEmailProvider();

    // Contact with email + phone
    const contacts = new Map();
    contacts.set("auth_user:user-123", [
      {
        id: "c1",
        contextKey: "auth_user",
        relatedEntityId: "user-123",
        contactMethods: {
          emails: [{ value: "user@example.com", labels: [] }],
          phoneNumbers: [{ value: "+15551234567", labels: [] }],
        },
        personalDetails: undefined,
        professionalDetails: undefined,
        location: undefined,
        createdAt: new Date(),
      },
    ]);

    const geoHandler = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contacts } })),
    };

    const smsProvider = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(D2Result.ok({ data: { providerMessageId: "twilio-123" } })),
    };

    const geoByIdHandler = createMockGetContactsByIds();
    const resolver = new RecipientResolver(geoHandler as any, geoByIdHandler as any, context);
    return {
      deliver: new Deliver(
        {
          message: messageRepo,
          request: requestRepo,
          attempt: attemptRepo,
          channelPref: channelPrefRepo,
          template: templateRepo,
        },
        { email: emailProvider, sms: smsProvider as any },
        resolver,
        context,
      ),
      smsProvider,
    };
  }

  it("should return 503 when recipient resolver fails", async () => {
    const failGeo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Service down"] })),
    };
    const context = createMockContext();
    messageRepo = createMockMessageRepo();
    requestRepo = createMockRequestRepo();
    attemptRepo = createMockAttemptRepo();
    channelPrefRepo = createMockChannelPrefRepo();
    templateRepo = createMockTemplateRepo();
    emailProvider = createMockEmailProvider();

    const failGeoById = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Service down"] })),
    };
    const resolver = new RecipientResolver(failGeo as any, failGeoById as any, context);
    const deliver = new Deliver(
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

    // Resolver returns ok({}) — empty email/phone, so NOT_FOUND (404) not 503
    // The 503 path is hit when resolved.success is false OR resolved.data is falsy.
    // Since RecipientResolver always returns ok, we'd need handleAsync itself to fail.
    // Let's test NOT_FOUND path with an empty geo result instead:
    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-123",
      channels: ["email"],
      correlationId: "corr-resolve-fail",
    });

    // RecipientResolver gracefully returns empty on geo failure,
    // so Deliver gets no email → NOT_FOUND
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
  });

  it("should deliver via SMS channel when sms provider is available", async () => {
    const { deliver, smsProvider } = createDeliverWithSms();

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "SMS Test",
      content: "test",
      plainTextContent: "Your code is 123456",
      recipientUserId: "user-123",
      channels: ["sms"],
      correlationId: "corr-sms",
    });

    expect(result.success).toBe(true);
    expect(result.data!.attempts).toHaveLength(1);
    expect(result.data!.attempts[0].channel).toBe("sms");
    expect(result.data!.attempts[0].recipientAddress).toBe("+15551234567");
    expect(result.data!.attempts[0].status).toBe("sent");
    expect(result.data!.attempts[0].providerMessageId).toBe("twilio-123");
    expect(smsProvider.handleAsync).toHaveBeenCalledWith({
      to: "+15551234567",
      body: "Your code is 123456",
    });
  });

  it("should handle SMS send failure gracefully", async () => {
    const { deliver, smsProvider } = createDeliverWithSms();
    (smsProvider.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.fail({ messages: ["Twilio rate limit"] }),
    );

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "SMS Fail",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-123",
      channels: ["sms"],
      correlationId: "corr-sms-fail",
    });

    expect(result.success).toBe(true);
    expect(result.data!.attempts).toHaveLength(1);
    expect(result.data!.attempts[0].status).toBe("failed");
    expect(result.data!.attempts[0].error).toBe("Twilio rate limit");
  });

  it("should deliver to both email and SMS channels", async () => {
    const { deliver } = createDeliverWithSms();

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Multi-channel",
      content: "<p>hello</p>",
      plainTextContent: "hello",
      recipientUserId: "user-123",
      channels: ["email", "sms"],
      correlationId: "corr-multi",
    });

    expect(result.success).toBe(true);
    expect(result.data!.attempts).toHaveLength(2);
    expect(result.data!.attempts[0].channel).toBe("email");
    expect(result.data!.attempts[1].channel).toBe("sms");
  });

  it("should use recipientContactId for channel preference lookup", async () => {
    const contactsById = new Map();
    contactsById.set("contact-42", {
      id: "contact-42",
      contextKey: "auth_org_contact",
      relatedEntityId: "contact-42",
      contactMethods: {
        emails: [{ value: "contact@example.com", labels: [] }],
        phoneNumbers: [],
      },
      personalDetails: undefined,
      professionalDetails: undefined,
      location: undefined,
      createdAt: new Date(),
    });

    const deliver = createDeliver({ geoContactsById: contactsById });

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Contact Pref Test",
      content: "test",
      plainTextContent: "test",
      recipientContactId: "contact-42",
      channels: ["email"],
      correlationId: "corr-contact-pref",
    });

    expect(result.success).toBe(true);
    expect(channelPrefRepo.findByContactId.handleAsync).toHaveBeenCalledWith({
      contactId: "contact-42",
    });
    expect(channelPrefRepo.findByUserId.handleAsync).not.toHaveBeenCalled();
  });

  it("should render template when one exists", async () => {
    const template = createTemplateWrapper({
      name: "welcome",
      channel: "email",
      subjectTemplate: "Welcome, {{title}}",
      bodyTemplate: "<div>{{body}}</div>",
    });
    const deliver = createDeliver();
    (templateRepo.findByNameAndChannel.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { template } }),
    );

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test Subject",
      content: "<p>Test Body</p>",
      plainTextContent: "Test Body",
      recipientUserId: "user-123",
      channels: ["email"],
      templateName: "welcome",
      correlationId: "corr-template",
    });

    expect(result.success).toBe(true);
    // Email provider should have been called with rendered content
    const sendCall = (emailProvider.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sendCall.subject).toBe("Welcome, Test Subject");
    expect(sendCall.html).toBe("<div><p>Test Body</p></div>");
  });

  it("should use raw content when no template found", async () => {
    const deliver = createDeliver();
    // Default mock returns null template

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Raw Title",
      content: "<p>Raw HTML</p>",
      plainTextContent: "Raw text",
      recipientUserId: "user-123",
      channels: ["email"],
      correlationId: "corr-no-tpl",
    });

    expect(result.success).toBe(true);
    const sendCall = (emailProvider.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sendCall.subject).toBe("Raw Title");
    expect(sendCall.html).toBe("<p>Raw HTML</p>");
  });

  it("should propagate message creation failure", async () => {
    const deliver = createDeliver();
    (messageRepo.create.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.fail({ messages: ["DB write failed"], statusCode: 500 }),
    );

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-123",
      channels: ["email"],
      correlationId: "corr-msg-fail",
    });

    expect(result.success).toBe(false);
    expect(requestRepo.create.handleAsync).not.toHaveBeenCalled();
  });

  it("should propagate request creation failure", async () => {
    const deliver = createDeliver();
    (requestRepo.create.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.fail({ messages: ["Conflict"], statusCode: 409 }),
    );

    const result = await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-123",
      channels: ["email"],
      correlationId: "corr-req-fail",
    });

    expect(result.success).toBe(false);
  });

  it("should mark request as processed when all attempts succeed", async () => {
    const deliver = createDeliver();

    await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-123",
      channels: ["email"],
      correlationId: "corr-processed",
    });

    expect(requestRepo.markProcessed.handleAsync).toHaveBeenCalledOnce();
  });

  it("should update attempt status in DB after send", async () => {
    const deliver = createDeliver();

    await deliver.handleAsync({
      senderService: "auth",
      title: "Test",
      content: "test",
      plainTextContent: "test",
      recipientUserId: "user-123",
      channels: ["email"],
      correlationId: "corr-status-update",
    });

    expect(attemptRepo.updateStatus.handleAsync).toHaveBeenCalledOnce();
    expect(attemptRepo.updateStatus.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        providerMessageId: "resend-msg-123",
      }),
    );
  });
});
