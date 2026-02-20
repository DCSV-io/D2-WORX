import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import {
  createMessage,
  createDeliveryRequest,
  createDeliveryAttempt,
  transitionDeliveryAttemptStatus,
  markDeliveryRequestProcessed,
  resolveChannels,
  computeNextRetryAt,
  isMaxAttemptsReached,
} from "@d2/comms-domain";
import type { Channel, DeliveryAttempt } from "@d2/comms-domain";
import type {
  MessageRepoHandlers,
  DeliveryRequestRepoHandlers,
  DeliveryAttemptRepoHandlers,
  ChannelPreferenceRepoHandlers,
  TemplateWrapperRepoHandlers,
} from "../../../../interfaces/repository/handlers/index.js";
import type { IEmailProvider, SendEmailInput } from "../../../../interfaces/providers/index.js";
import type { ISmsProvider } from "../../../../interfaces/providers/index.js";
import type { RecipientResolver } from "./resolve-recipient.js";

export interface DeliverInput {
  readonly senderService: string;
  readonly title: string;
  readonly content: string;
  readonly plainTextContent: string;
  readonly sensitive?: boolean;
  readonly urgency?: "normal" | "important" | "urgent";
  readonly recipientUserId?: string;
  readonly recipientContactId?: string;
  readonly channels?: readonly Channel[];
  readonly templateName?: string;
  readonly correlationId: string;
}

export interface DeliverOutput {
  readonly messageId: string;
  readonly requestId: string;
  readonly attempts: DeliveryAttempt[];
}

/**
 * Core delivery orchestrator. Creates Message + DeliveryRequest, resolves
 * the recipient's address, determines channels, renders templates, and
 * dispatches via providers (Resend for email, Twilio for SMS).
 */
export class Deliver extends BaseHandler<DeliverInput, DeliverOutput> {
  private readonly messageRepo: MessageRepoHandlers;
  private readonly requestRepo: DeliveryRequestRepoHandlers;
  private readonly attemptRepo: DeliveryAttemptRepoHandlers;
  private readonly channelPrefRepo: ChannelPreferenceRepoHandlers;
  private readonly templateRepo: TemplateWrapperRepoHandlers;
  private readonly emailProvider: IEmailProvider;
  private readonly smsProvider: ISmsProvider | undefined;
  private readonly recipientResolver: RecipientResolver;

  constructor(
    repos: {
      message: MessageRepoHandlers;
      request: DeliveryRequestRepoHandlers;
      attempt: DeliveryAttemptRepoHandlers;
      channelPref: ChannelPreferenceRepoHandlers;
      template: TemplateWrapperRepoHandlers;
    },
    providers: { email: IEmailProvider; sms?: ISmsProvider },
    recipientResolver: RecipientResolver,
    context: IHandlerContext,
  ) {
    super(context);
    this.messageRepo = repos.message;
    this.requestRepo = repos.request;
    this.attemptRepo = repos.attempt;
    this.channelPrefRepo = repos.channelPref;
    this.templateRepo = repos.template;
    this.emailProvider = providers.email;
    this.smsProvider = providers.sms;
    this.recipientResolver = recipientResolver;
  }

  protected async executeAsync(
    input: DeliverInput,
  ): Promise<D2Result<DeliverOutput | undefined>> {
    // Step 0: Idempotency check via correlationId
    const existing = await this.requestRepo.findByCorrelationId.handleAsync({
      correlationId: input.correlationId,
    });
    if (existing.success && existing.data?.request) {
      // Already processed — return existing data
      const existingAttempts = await this.attemptRepo.findByRequestId.handleAsync({
        requestId: existing.data.request.id,
      });
      return D2Result.ok({
        data: {
          messageId: existing.data.request.messageId,
          requestId: existing.data.request.id,
          attempts: existingAttempts.data?.attempts ?? [],
        },
        traceId: this.traceId,
      });
    }

    // Step 1: Create domain Message
    const message = createMessage({
      senderService: input.senderService,
      title: input.title,
      content: input.content,
      plainTextContent: input.plainTextContent,
      sensitive: input.sensitive,
      urgency: input.urgency,
    });

    // Step 2: Create domain DeliveryRequest
    const request = createDeliveryRequest({
      messageId: message.id,
      correlationId: input.correlationId,
      recipientUserId: input.recipientUserId,
      recipientContactId: input.recipientContactId,
      channels: input.channels,
      templateName: input.templateName,
    });

    // Step 3: Persist message + request
    const msgResult = await this.messageRepo.create.handleAsync({ message });
    if (!msgResult.success) return D2Result.bubbleFail(msgResult);

    const reqResult = await this.requestRepo.create.handleAsync({ request });
    if (!reqResult.success) return D2Result.bubbleFail(reqResult);

    // Step 4: Resolve recipient address
    const resolved = await this.recipientResolver.handleAsync({
      userId: input.recipientUserId,
      contactId: input.recipientContactId,
    });

    if (!resolved.success || !resolved.data) {
      return D2Result.fail({
        messages: ["Failed to resolve recipient address."],
        statusCode: 503,
        traceId: this.traceId,
      });
    }

    const { email, phone } = resolved.data;

    // Step 5: Resolve channel preferences
    let prefs = null;
    if (input.recipientUserId) {
      const prefResult = await this.channelPrefRepo.findByUserId.handleAsync({
        userId: input.recipientUserId,
      });
      if (prefResult.success && prefResult.data) {
        prefs = prefResult.data.pref;
      }
    } else if (input.recipientContactId) {
      const prefResult = await this.channelPrefRepo.findByContactId.handleAsync({
        contactId: input.recipientContactId,
      });
      if (prefResult.success && prefResult.data) {
        prefs = prefResult.data.pref;
      }
    }

    // Step 6: Resolve channels via domain rule
    const channelsResult = resolveChannels(input.channels ?? null, prefs, message);

    // Step 7: Check if we have addresses for resolved channels
    const deliverableChannels: Array<{ channel: Channel; address: string }> = [];
    for (const ch of channelsResult.channels) {
      if (ch === "email" && email) {
        deliverableChannels.push({ channel: "email", address: email });
      } else if (ch === "sms" && phone) {
        deliverableChannels.push({ channel: "sms", address: phone });
      }
    }

    if (deliverableChannels.length === 0) {
      return D2Result.notFound({
        messages: ["No deliverable address found for any resolved channel."],
        traceId: this.traceId,
      });
    }

    // Step 8: Deliver to each channel
    const attempts: DeliveryAttempt[] = [];

    for (const { channel, address } of deliverableChannels) {
      // Look up template
      const templateName = input.templateName ?? "default";
      const tplResult = await this.templateRepo.findByNameAndChannel.handleAsync({
        name: templateName,
        channel,
      });
      const template = tplResult.success ? tplResult.data?.template : null;

      // Render content
      const subject = template?.subjectTemplate
        ? renderTemplate(template.subjectTemplate, { title: input.title, body: input.plainTextContent })
        : input.title;
      const html = template?.bodyTemplate
        ? renderTemplate(template.bodyTemplate, { title: input.title, body: input.content })
        : input.content;

      // Create attempt
      let attempt = createDeliveryAttempt({
        requestId: request.id,
        channel,
        recipientAddress: address,
        attemptNumber: 1,
      });

      // Dispatch
      if (channel === "email") {
        const sendInput: SendEmailInput = {
          to: address,
          subject: subject ?? input.title,
          html,
          plainText: input.plainTextContent,
        };
        const sendResult = await this.emailProvider.handleAsync(sendInput);

        if (sendResult.success && sendResult.data) {
          attempt = transitionDeliveryAttemptStatus(attempt, "sent", {
            providerMessageId: sendResult.data.providerMessageId,
          });
        } else {
          const errorMsg = sendResult.messages?.join("; ") ?? "Email send failed";
          const nextRetryAt = isMaxAttemptsReached(attempt.attemptNumber)
            ? null
            : computeNextRetryAt(attempt.attemptNumber);
          attempt = transitionDeliveryAttemptStatus(attempt, "failed", {
            error: errorMsg,
            nextRetryAt,
          });
        }
      } else if (channel === "sms" && this.smsProvider) {
        const sendResult = await this.smsProvider.handleAsync({
          to: address,
          body: input.plainTextContent,
        });

        if (sendResult.success && sendResult.data) {
          attempt = transitionDeliveryAttemptStatus(attempt, "sent", {
            providerMessageId: sendResult.data.providerMessageId,
          });
        } else {
          const errorMsg = sendResult.messages?.join("; ") ?? "SMS send failed";
          const nextRetryAt = isMaxAttemptsReached(attempt.attemptNumber)
            ? null
            : computeNextRetryAt(attempt.attemptNumber);
          attempt = transitionDeliveryAttemptStatus(attempt, "failed", {
            error: errorMsg,
            nextRetryAt,
          });
        }
      }

      // Persist attempt
      await this.attemptRepo.create.handleAsync({ attempt });

      // Update status in DB if not pending
      if (attempt.status !== "pending") {
        await this.attemptRepo.updateStatus.handleAsync({
          id: attempt.id,
          status: attempt.status,
          providerMessageId: attempt.providerMessageId ?? undefined,
          error: attempt.error ?? undefined,
          nextRetryAt: attempt.nextRetryAt,
        });
      }

      attempts.push(attempt);
    }

    // Step 9: If all attempts are terminal, mark request as processed
    const allTerminal = attempts.every((a) => a.status === "sent" || a.status === "failed");
    const allFailed = attempts.every((a) => a.status === "failed");
    const noRetries = allFailed && attempts.every((a) => a.nextRetryAt === null);

    if (allTerminal && (!allFailed || noRetries)) {
      const processed = markDeliveryRequestProcessed(request);
      await this.requestRepo.markProcessed.handleAsync({ id: processed.id });
    }

    return D2Result.ok({
      data: {
        messageId: message.id,
        requestId: request.id,
        attempts,
      },
      traceId: this.traceId,
    });
  }
}

/** Simple {{key}} template interpolation. */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
