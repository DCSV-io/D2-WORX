import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { SendInvitationEmail } from "../../../../messages/index.js";
import type {
  IPublishInvitationEmailHandler,
  PublishInvitationEmailOutput,
} from "../../../../interfaces/messaging/handlers/pub/publish-invitation-email.js";

const schema = z.object({
  invitationId: zodGuid,
  inviteeEmail: z.string().email().max(254),
  organizationId: zodGuid,
  organizationName: z.string().max(128),
  role: z.string().max(32),
  inviterName: z.string().max(128),
  inviterEmail: z.string().email().max(254),
  invitationUrl: z.string().url().max(2048),
});

/**
 * Publishes an organization invitation email notification via RabbitMQ.
 *
 * Currently stubbed — logs the request and returns success.
 * Will be wired to a real publisher when the notification service is built.
 */
export class PublishInvitationEmail
  extends BaseHandler<SendInvitationEmail, PublishInvitationEmailOutput>
  implements IPublishInvitationEmailHandler
{
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(
    input: SendInvitationEmail,
  ): Promise<D2Result<PublishInvitationEmailOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    // TODO: Publish to RabbitMQ when notification service is built
    this.context.logger.info(
      `Invitation email requested for ${input.inviteeEmail} to org ${input.organizationName} (role: ${input.role}). TraceId: ${this.traceId}`,
    );

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
