import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { SendVerificationEmailEvent } from "@d2/protos";
import { generateUuidV7, escapeHtml } from "@d2/utilities";
import { COMMS_MESSAGING, TEMPLATE_NAMES } from "@d2/comms-domain";
import type {
  IHandleVerificationEmailHandler,
  HandleVerificationEmailOutput,
} from "../../../../interfaces/messaging/handlers/sub/handle-verification-email.js";
import type { Deliver } from "../../../cqrs/handlers/x/deliver.js";

/**
 * Handles the SendVerificationEmailEvent from the auth service.
 * Constructs message content from event fields and delegates to the Deliver orchestrator.
 */
export class HandleVerificationEmail
  extends BaseHandler<SendVerificationEmailEvent, HandleVerificationEmailOutput>
  implements IHandleVerificationEmailHandler
{
  private readonly deliver: Deliver;

  constructor(deliver: Deliver, context: IHandlerContext) {
    super(context);
    this.deliver = deliver;
  }

  protected async executeAsync(
    input: SendVerificationEmailEvent,
  ): Promise<D2Result<HandleVerificationEmailOutput | undefined>> {
    const result = await this.deliver.handleAsync({
      senderService: COMMS_MESSAGING.SENDER_AUTH,
      title: "Verify your email address",
      content: `<p>Hi ${escapeHtml(input.name)},</p><p>Please verify your email address by clicking the link below:</p><p><a href="${escapeHtml(input.verificationUrl)}">Verify Email</a></p>`,
      plainTextContent: `Hi ${input.name}, please verify your email by visiting: ${input.verificationUrl}`,
      sensitive: true,
      recipientUserId: input.userId,
      channels: ["email"],
      templateName: TEMPLATE_NAMES.EMAIL_VERIFICATION,
      correlationId: generateUuidV7(),
    });

    if (!result.success) return D2Result.bubbleFail(result);
    return D2Result.ok({ data: {} });
  }
}
