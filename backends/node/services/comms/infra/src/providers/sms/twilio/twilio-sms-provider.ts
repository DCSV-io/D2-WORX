import twilio from "twilio";
import type { Twilio } from "twilio";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  ISmsProvider,
  SendSmsInput,
  SendSmsOutput,
} from "@d2/comms-app";

/**
 * Sends SMS via the Twilio API.
 * Implements the ISmsProvider interface from the app layer.
 */
export class TwilioSmsProvider
  extends BaseHandler<SendSmsInput, SendSmsOutput>
  implements ISmsProvider
{
  private readonly client: Twilio;
  private readonly from: string;

  constructor(accountSid: string, authToken: string, from: string, context: IHandlerContext) {
    super(context);
    this.client = twilio(accountSid, authToken);
    this.from = from;
  }

  get redaction() {
    return { inputFields: ["body"] as const };
  }

  protected async executeAsync(
    input: SendSmsInput,
  ): Promise<D2Result<SendSmsOutput | undefined>> {
    try {
      const message = await this.client.messages.create({
        from: this.from,
        to: input.to,
        body: input.body,
      });

      return D2Result.ok({
        data: { providerMessageId: message.sid },
        traceId: this.traceId,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown Twilio error";

      return D2Result.fail({
        messages: [errorMessage],
        statusCode: 503,
        traceId: this.traceId,
      });
    }
  }
}
