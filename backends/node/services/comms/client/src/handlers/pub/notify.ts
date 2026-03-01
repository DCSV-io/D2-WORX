import { z } from "zod";
import { BaseHandler, type IHandlerContext, type RedactionSpec, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { IMessagePublisher } from "@d2/messaging";
import { COMMS_EVENTS } from "../../comms-client-constants.js";

export interface NotifyInput {
  /** Geo contact ID — the ONLY recipient identifier. */
  readonly recipientContactId: string;
  /** Email subject, SMS prefix, push title. */
  readonly title: string;
  /** Markdown content — rendered to HTML for email. */
  readonly content: string;
  /** Plain text — SMS body, email fallback. */
  readonly plaintext: string;
  /** Default false. true = email only (secure channel). */
  readonly sensitive?: boolean;
  /** Default "normal". "urgent" = bypass prefs, force all channels. */
  readonly urgency?: "normal" | "urgent";
  /** Idempotency key for deduplication. */
  readonly correlationId: string;
  /** Source service identifier (e.g. "auth", "billing"). */
  readonly senderService: string;
  /** Arbitrary key-value metadata for future use. */
  readonly metadata?: Record<string, unknown>;
}

export interface NotifyOutput {}

const notifySchema = z.object({
  recipientContactId: zodGuid,
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(50_000),
  plaintext: z.string().min(1).max(50_000),
  sensitive: z.boolean().optional().default(false),
  urgency: z.enum(["normal", "urgent"]).optional().default("normal"),
  correlationId: z.string().min(1).max(36),
  senderService: z.string().min(1).max(50),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Validates and publishes a notification request to the Comms service
 * via RabbitMQ. The Comms service receives a universal message shape,
 * resolves the contact's address, picks channels, renders markdown to
 * HTML, and delivers.
 *
 * When no publisher is provided (local dev, tests without RabbitMQ),
 * the handler logs the notification and returns success.
 */
export class Notify extends BaseHandler<NotifyInput, NotifyOutput> {
  private readonly publisher: IMessagePublisher | undefined;

  get redaction(): RedactionSpec {
    return { inputFields: ["content", "plaintext"] };
  }

  constructor(context: IHandlerContext, publisher?: IMessagePublisher) {
    super(context);
    this.publisher = publisher;
  }

  protected async executeAsync(input: NotifyInput): Promise<D2Result<NotifyOutput | undefined>> {
    const validation = this.validateInput(notifySchema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    if (!this.publisher) {
      this.context.logger.info("No publisher configured — notification logged but not sent", {
        recipientContactId: input.recipientContactId,
        title: input.title,
        senderService: input.senderService,
        correlationId: input.correlationId,
      });
      return D2Result.ok({ data: {} });
    }

    await this.publisher.send(
      {
        exchange: COMMS_EVENTS.NOTIFICATIONS_EXCHANGE,
        routingKey: "",
      },
      {
        recipientContactId: input.recipientContactId,
        title: input.title,
        content: input.content,
        plaintext: input.plaintext,
        sensitive: input.sensitive ?? false,
        urgency: input.urgency ?? "normal",
        correlationId: input.correlationId,
        senderService: input.senderService,
        metadata: input.metadata,
      },
    );

    return D2Result.ok({ data: {} });
  }
}
