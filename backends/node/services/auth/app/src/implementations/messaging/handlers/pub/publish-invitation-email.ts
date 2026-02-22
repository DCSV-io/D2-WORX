import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { IMessagePublisher } from "@d2/messaging";
import { SendInvitationEmailEventFns } from "@d2/protos";
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
 * Validates input via Zod, then publishes to the `events.auth` fanout exchange
 * as JSON. The comms service consumes from this exchange.
 */
export class PublishInvitationEmail
  extends BaseHandler<SendInvitationEmail, PublishInvitationEmailOutput>
  implements IPublishInvitationEmailHandler
{
  private readonly publisher: IMessagePublisher | undefined;

  constructor(context: IHandlerContext, publisher?: IMessagePublisher) {
    super(context);
    this.publisher = publisher;
  }

  protected async executeAsync(
    input: SendInvitationEmail,
  ): Promise<D2Result<PublishInvitationEmailOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    if (this.publisher) {
      await this.publisher.send(
        { exchange: "events.auth", routingKey: "" },
        SendInvitationEmailEventFns.toJSON({
          invitationId: input.invitationId,
          inviteeEmail: input.inviteeEmail,
          organizationId: input.organizationId,
          organizationName: input.organizationName,
          role: input.role,
          inviterName: input.inviterName,
          inviterEmail: input.inviterEmail,
          invitationUrl: input.invitationUrl,
        }),
      );
    } else {
      this.context.logger.info(
        `Invitation email requested for ${input.inviteeEmail} to org ${input.organizationName} (role: ${input.role}). TraceId: ${this.traceId} [no publisher configured]`,
      );
    }

    return D2Result.ok({ data: {} });
  }
}
