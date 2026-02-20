import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { IMessagePublisher } from "@d2/messaging";
import { SendVerificationEmailEventFns } from "@d2/protos";
import type { SendVerificationEmail } from "../../../../messages/index.js";
import type {
  IPublishVerificationEmailHandler,
  PublishVerificationEmailOutput,
} from "../../../../interfaces/messaging/handlers/pub/publish-verification-email.js";

const schema = z.object({
  userId: zodGuid,
  email: z.string().email().max(254),
  name: z.string().max(128),
  verificationUrl: z.string().url().max(2048),
  token: z.string().min(1).max(512),
});

/**
 * Publishes a verification email notification via RabbitMQ.
 *
 * Validates input via Zod, then publishes to the `events.auth` fanout exchange
 * as JSON. The comms service consumes from this exchange.
 *
 * Mirrors Geo.Infra.Messaging.Handlers.Pub.Update pattern in .NET.
 */
export class PublishVerificationEmail
  extends BaseHandler<SendVerificationEmail, PublishVerificationEmailOutput>
  implements IPublishVerificationEmailHandler
{
  private readonly publisher: IMessagePublisher | undefined;

  constructor(context: IHandlerContext, publisher?: IMessagePublisher) {
    super(context);
    this.publisher = publisher;
  }

  protected async executeAsync(
    input: SendVerificationEmail,
  ): Promise<D2Result<PublishVerificationEmailOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    if (this.publisher) {
      await this.publisher.send(
        { exchange: "events.auth", routingKey: "" },
        SendVerificationEmailEventFns.toJSON({
          userId: input.userId,
          email: input.email,
          name: input.name,
          verificationUrl: input.verificationUrl,
          token: input.token,
        }),
      );
    } else {
      this.context.logger.info(
        `Verification email requested for ${input.email} (userId: ${input.userId}). TraceId: ${this.traceId} [no publisher configured]`,
      );
    }

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
