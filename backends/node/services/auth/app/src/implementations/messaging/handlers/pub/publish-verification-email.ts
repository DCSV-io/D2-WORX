import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
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
 * Currently stubbed — logs the request and returns success.
 * Will be wired to a real publisher when the notification service is built.
 *
 * Mirrors Geo.Infra.Messaging.Handlers.Pub.Update pattern in .NET.
 */
export class PublishVerificationEmail
  extends BaseHandler<SendVerificationEmail, PublishVerificationEmailOutput>
  implements IPublishVerificationEmailHandler
{
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(
    input: SendVerificationEmail,
  ): Promise<D2Result<PublishVerificationEmailOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    // TODO: Publish to RabbitMQ when notification service is built
    this.context.logger.info(
      `Verification email requested for ${input.email} (userId: ${input.userId}). TraceId: ${this.traceId}`,
    );

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
