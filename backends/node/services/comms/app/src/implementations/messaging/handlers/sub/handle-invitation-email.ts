import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { SendInvitationEmailEvent } from "@d2/protos";
import { generateUuidV7 } from "@d2/utilities";
import type {
  IHandleInvitationEmailHandler,
  HandleInvitationEmailOutput,
} from "../../../../interfaces/messaging/handlers/sub/handle-invitation-email.js";
import type { Deliver } from "../../../cqrs/handlers/x/deliver.js";

/**
 * Handles the SendInvitationEmailEvent from the auth service.
 * Constructs message content from event fields and delegates to the Deliver orchestrator.
 */
export class HandleInvitationEmail
  extends BaseHandler<SendInvitationEmailEvent, HandleInvitationEmailOutput>
  implements IHandleInvitationEmailHandler
{
  private readonly deliver: Deliver;

  constructor(deliver: Deliver, context: IHandlerContext) {
    super(context);
    this.deliver = deliver;
  }

  protected async executeAsync(
    input: SendInvitationEmailEvent,
  ): Promise<D2Result<HandleInvitationEmailOutput | undefined>> {
    const result = await this.deliver.handleAsync({
      senderService: "auth",
      title: `You've been invited to ${input.organizationName}`,
      content: `<p>Hi,</p><p>${input.inviterName} (${input.inviterEmail}) has invited you to join <strong>${input.organizationName}</strong> as <strong>${input.role}</strong>.</p><p><a href="${input.invitationUrl}">Accept Invitation</a></p>`,
      plainTextContent: `${input.inviterName} (${input.inviterEmail}) has invited you to join ${input.organizationName} as ${input.role}. Accept: ${input.invitationUrl}`,
      sensitive: false,
      recipientContactId: input.inviteeEmail,
      channels: ["email"],
      templateName: "invitation",
      correlationId: generateUuidV7(),
    });

    if (!result.success) return D2Result.bubbleFail(result);
    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
