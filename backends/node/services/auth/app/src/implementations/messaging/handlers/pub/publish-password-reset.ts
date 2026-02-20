import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { IMessagePublisher } from "@d2/messaging";
import { SendPasswordResetEventFns } from "@d2/protos";
import type { SendPasswordReset } from "../../../../messages/index.js";
import type {
  IPublishPasswordResetHandler,
  PublishPasswordResetOutput,
} from "../../../../interfaces/messaging/handlers/pub/publish-password-reset.js";

const schema = z.object({
  userId: zodGuid,
  email: z.string().email().max(254),
  name: z.string().max(128),
  resetUrl: z.string().url().max(2048),
  token: z.string().min(1).max(512),
});

/**
 * Publishes a password reset email notification via RabbitMQ.
 *
 * Validates input via Zod, then publishes to the `events.auth` fanout exchange
 * as JSON. The comms service consumes from this exchange.
 */
export class PublishPasswordReset
  extends BaseHandler<SendPasswordReset, PublishPasswordResetOutput>
  implements IPublishPasswordResetHandler
{
  private readonly publisher: IMessagePublisher | undefined;

  constructor(context: IHandlerContext, publisher?: IMessagePublisher) {
    super(context);
    this.publisher = publisher;
  }

  protected async executeAsync(
    input: SendPasswordReset,
  ): Promise<D2Result<PublishPasswordResetOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    if (this.publisher) {
      await this.publisher.send(
        { exchange: "events.auth", routingKey: "" },
        SendPasswordResetEventFns.toJSON({
          userId: input.userId,
          email: input.email,
          name: input.name,
          resetUrl: input.resetUrl,
          token: input.token,
        }),
      );
    } else {
      this.context.logger.info(
        `Password reset requested for ${input.email} (userId: ${input.userId}). TraceId: ${this.traceId} [no publisher configured]`,
      );
    }

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
