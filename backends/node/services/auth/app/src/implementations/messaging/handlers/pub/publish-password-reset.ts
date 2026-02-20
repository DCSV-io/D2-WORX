import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
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
 * Currently stubbed — logs the request and returns success.
 * Will be wired to a real publisher when the notification service is built.
 */
export class PublishPasswordReset
  extends BaseHandler<SendPasswordReset, PublishPasswordResetOutput>
  implements IPublishPasswordResetHandler
{
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(
    input: SendPasswordReset,
  ): Promise<D2Result<PublishPasswordResetOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    // TODO: Publish to RabbitMQ when notification service is built
    this.context.logger.info(
      `Password reset requested for ${input.email} (userId: ${input.userId}). TraceId: ${this.traceId}`,
    );

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
