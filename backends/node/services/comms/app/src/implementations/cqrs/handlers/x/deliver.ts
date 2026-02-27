import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
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
  COMMS_RETRY,
} from "@d2/comms-domain";
import type { Channel, DeliveryAttempt } from "@d2/comms-domain";
import type {
  MessageRepoHandlers,
  DeliveryRequestRepoHandlers,
  DeliveryAttemptRepoHandlers,
  ChannelPreferenceRepoHandlers,
} from "../../../../interfaces/repository/handlers/index.js";
import type { RecipientResolver } from "./resolve-recipient.js";
import type { IChannelDispatcher } from "./channel-dispatchers.js";

export interface DeliverInput {
  readonly senderService: string;
  readonly title: string;
  readonly content: string;
  readonly plainTextContent: string;
  readonly sensitive?: boolean;
  readonly urgency?: "normal" | "urgent";
  readonly recipientContactId: string;
  readonly correlationId: string;
  readonly metadata?: Record<string, unknown>;
}

export interface DeliverOutput {
  readonly messageId: string;
  readonly requestId: string;
  readonly attempts: DeliveryAttempt[];
}

const deliverSchema = z.object({
  correlationId: zodGuid,
  recipientContactId: zodGuid,
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(50_000),
  plainTextContent: z.string().max(50_000),
  sensitive: z.boolean().optional(),
  urgency: z.enum(["normal", "urgent"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  senderService: z.string().min(1).max(50),
});

/**
 * Core delivery orchestrator. Creates Message + DeliveryRequest, resolves
 * the recipient's address, determines channels, and dispatches via channel
 * dispatchers in parallel (Promise.allSettled).
 *
 * Channel-specific logic (content transformation, provider invocation) is
 * delegated to IChannelDispatcher implementations. The handler owns
 * orchestration: attempt creation, domain rule application, persistence.
 */
export class Deliver extends BaseHandler<DeliverInput, DeliverOutput> {
  private readonly messageRepo: MessageRepoHandlers;
  private readonly requestRepo: DeliveryRequestRepoHandlers;
  private readonly attemptRepo: DeliveryAttemptRepoHandlers;
  private readonly channelPrefRepo: ChannelPreferenceRepoHandlers;
  private readonly dispatchers: Map<Channel, IChannelDispatcher>;
  private readonly recipientResolver: RecipientResolver;

  constructor(
    repos: {
      message: MessageRepoHandlers;
      request: DeliveryRequestRepoHandlers;
      attempt: DeliveryAttemptRepoHandlers;
      channelPref: ChannelPreferenceRepoHandlers;
    },
    dispatchers: IChannelDispatcher[],
    recipientResolver: RecipientResolver,
    context: IHandlerContext,
  ) {
    super(context);
    this.messageRepo = repos.message;
    this.requestRepo = repos.request;
    this.attemptRepo = repos.attempt;
    this.channelPrefRepo = repos.channelPref;
    this.dispatchers = new Map(dispatchers.map((d) => [d.channel, d]));
    this.recipientResolver = recipientResolver;
  }

  protected async executeAsync(input: DeliverInput): Promise<D2Result<DeliverOutput | undefined>> {
    // Step 0a: Validate input
    const validation = this.validateInput(deliverSchema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    // Step 0b: Idempotency check via correlationId
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
      metadata: input.metadata,
    });

    // Step 2: Create domain DeliveryRequest
    const request = createDeliveryRequest({
      messageId: message.id,
      correlationId: input.correlationId,
      recipientContactId: input.recipientContactId,
    });

    // Step 3: Persist message + request
    const msgResult = await this.messageRepo.create.handleAsync({ message });
    if (!msgResult.success) return D2Result.bubbleFail(msgResult);

    const reqResult = await this.requestRepo.create.handleAsync({ request });
    if (!reqResult.success) return D2Result.bubbleFail(reqResult);

    // Step 4: Resolve recipient address
    const resolved = await this.recipientResolver.handleAsync({
      contactId: input.recipientContactId,
    });

    if (!resolved.success || !resolved.data) {
      return D2Result.bubbleFail(resolved);
    }

    const { email, phone } = resolved.data;

    // Step 5: Resolve channel preferences
    let prefs = null;
    const prefResult = await this.channelPrefRepo.findByContactId.handleAsync({
      contactId: input.recipientContactId,
    });
    if (prefResult.success && prefResult.data) {
      prefs = prefResult.data.pref;
    }

    // Step 6: Resolve channels via domain rule
    const channelsResult = resolveChannels(prefs, message);

    // Step 7: Filter to deliverable channels (must have address + dispatcher)
    const deliverableChannels: Array<{ channel: Channel; address: string }> = [];
    const skippedReasons: string[] = [];
    for (const ch of channelsResult.channels) {
      if (ch === "email" && email && this.dispatchers.has("email")) {
        deliverableChannels.push({ channel: "email", address: email });
      } else if (ch === "sms" && phone && this.dispatchers.has("sms")) {
        deliverableChannels.push({ channel: "sms", address: phone });
      } else if (ch === "email" && !email) {
        skippedReasons.push("email: no address on contact");
      } else if (ch === "email" && !this.dispatchers.has("email")) {
        skippedReasons.push("email: no dispatcher configured");
      } else if (ch === "sms" && !phone) {
        skippedReasons.push("sms: no phone number on contact");
      } else if (ch === "sms" && !this.dispatchers.has("sms")) {
        skippedReasons.push("sms: no dispatcher configured");
      }
    }

    if (skippedReasons.length > 0) {
      this.context.logger.warn(
        `Channels skipped: ${skippedReasons.join(", ")}. TraceId: ${this.traceId}`,
      );
    }

    if (deliverableChannels.length === 0) {
      const detail =
        skippedReasons.length > 0
          ? `No deliverable channels. Attempted: ${channelsResult.channels.join(", ")}. Skipped: ${skippedReasons.join("; ")}.`
          : "No deliverable address found for any resolved channel.";
      return D2Result.notFound({
        messages: [detail],
      });
    }

    // Step 8: Dispatch to all channels in parallel
    const dispatchTasks = deliverableChannels.map(({ channel, address }) => ({
      channel,
      address,
      attempt: createDeliveryAttempt({
        requestId: request.id,
        channel,
        recipientAddress: address,
        attemptNumber: 1,
      }),
    }));

    const results = await Promise.allSettled(
      dispatchTasks.map(async (task) => {
        const dispatcher = this.dispatchers.get(task.channel)!;
        const result = await dispatcher.dispatch({
          address: task.address,
          title: input.title,
          content: input.content,
          plainTextContent: input.plainTextContent,
        });
        return result;
      }),
    );

    // Step 8a: Process results and persist attempts
    const attempts: DeliveryAttempt[] = [];

    for (const [i, settled] of results.entries()) {
      let attempt = dispatchTasks[i]!.attempt;

      if (settled.status === "fulfilled") {
        const dispatchResult = settled.value;
        if (dispatchResult.success) {
          attempt = transitionDeliveryAttemptStatus(attempt, "sent", {
            providerMessageId: dispatchResult.providerMessageId,
          });
        } else {
          const nextRetryAt = isMaxAttemptsReached(attempt.attemptNumber)
            ? null
            : computeNextRetryAt(attempt.attemptNumber);
          attempt = transitionDeliveryAttemptStatus(attempt, "failed", {
            error: dispatchResult.error,
            nextRetryAt,
          });
        }
      } else {
        // Dispatcher threw — treat as failed with retry
        const nextRetryAt = isMaxAttemptsReached(attempt.attemptNumber)
          ? null
          : computeNextRetryAt(attempt.attemptNumber);
        attempt = transitionDeliveryAttemptStatus(attempt, "failed", {
          error: settled.reason instanceof Error ? settled.reason.message : "Dispatch error",
          nextRetryAt,
        });
      }

      // Persist attempt
      await this.attemptRepo.create.handleAsync({ attempt });

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

    // Step 8b: Check for retryable delivery failures
    const retryableFailures = attempts.filter(
      (a) => a.status === "failed" && a.nextRetryAt !== null,
    );
    if (retryableFailures.length > 0) {
      return D2Result.fail({
        messages: [`Delivery failed for ${retryableFailures.length} channel(s), retry scheduled.`],
        statusCode: 503,
        errorCode: COMMS_RETRY.DELIVERY_FAILED,
      });
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
    });
  }
}
