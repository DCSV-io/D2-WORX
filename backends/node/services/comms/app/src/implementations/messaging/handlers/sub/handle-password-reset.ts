import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { SendPasswordResetEvent } from "@d2/protos";
import { generateUuidV7, escapeHtml } from "@d2/utilities";
import { COMMS_MESSAGING, TEMPLATE_NAMES } from "@d2/comms-domain";
import type {
  IHandlePasswordResetHandler,
  HandlePasswordResetOutput,
} from "../../../../interfaces/messaging/handlers/sub/handle-password-reset.js";
import type { Deliver } from "../../../cqrs/handlers/x/deliver.js";

/**
 * Handles the SendPasswordResetEvent from the auth service.
 * Constructs message content from event fields and delegates to the Deliver orchestrator.
 */
export class HandlePasswordReset
  extends BaseHandler<SendPasswordResetEvent, HandlePasswordResetOutput>
  implements IHandlePasswordResetHandler
{
  private readonly deliver: Deliver;

  constructor(deliver: Deliver, context: IHandlerContext) {
    super(context);
    this.deliver = deliver;
  }

  protected async executeAsync(
    input: SendPasswordResetEvent,
  ): Promise<D2Result<HandlePasswordResetOutput | undefined>> {
    const result = await this.deliver.handleAsync({
      senderService: COMMS_MESSAGING.SENDER_AUTH,
      title: "Reset your password",
      content: `<p>Hi ${escapeHtml(input.name)},</p><p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${escapeHtml(input.resetUrl)}">Reset Password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
      plainTextContent: `Hi ${input.name}, you requested a password reset. Visit: ${input.resetUrl} — If you didn't request this, ignore this email.`,
      sensitive: true,
      recipientUserId: input.userId,
      channels: ["email"],
      templateName: TEMPLATE_NAMES.PASSWORD_RESET,
      correlationId: generateUuidV7(),
    });

    if (!result.success) return D2Result.bubbleFail(result);
    return D2Result.ok({ data: {} });
  }
}
