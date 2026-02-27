import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { generateUuidV7 } from "@d2/utilities";
import type { SendEmailInput, SendEmailOutput, IEmailProvider } from "@d2/comms-app";

interface CapturedEmail {
  to: string;
  subject: string;
  html: string;
  plainText?: string;
  providerMessageId: string;
  capturedAt: Date;
}

/**
 * Stub email provider for E2E tests. Captures all sent emails in memory
 * instead of dispatching via a real provider (Resend, SMTP, etc.).
 *
 * Implements `IEmailProvider` (extends `BaseHandler<SendEmailInput, SendEmailOutput>`).
 */
export class StubEmailProvider
  extends BaseHandler<SendEmailInput, SendEmailOutput>
  implements IEmailProvider
{
  private readonly emails: CapturedEmail[] = [];

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(
    input: SendEmailInput,
  ): Promise<D2Result<SendEmailOutput | undefined>> {
    const providerMessageId = `stub-${generateUuidV7()}`;

    this.emails.push({
      to: input.to,
      subject: input.subject,
      html: input.html,
      plainText: input.plainText,
      providerMessageId,
      capturedAt: new Date(),
    });

    return D2Result.ok({
      data: { providerMessageId },
    });
  }

  /** Returns all captured emails. */
  getSentEmails(): readonly CapturedEmail[] {
    return this.emails;
  }

  /** Returns the most recently captured email, or undefined. */
  getLastEmail(): CapturedEmail | undefined {
    return this.emails.at(-1);
  }

  /** Returns the number of captured emails. */
  sentCount(): number {
    return this.emails.length;
  }

  /** Clears all captured emails. */
  clear(): void {
    this.emails.length = 0;
  }
}
