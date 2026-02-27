import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import type { Channel } from "@d2/comms-domain";
import type { IEmailProvider, SendEmailInput } from "../../../../interfaces/providers/index.js";
import type { ISmsProvider } from "../../../../interfaces/providers/index.js";

/** Input for channel dispatch — content fields needed by all channels. */
export interface DispatchInput {
  readonly address: string;
  readonly title: string;
  readonly content: string;
  readonly plainTextContent: string;
}

/** Result of a channel dispatch — success/failure + provider metadata. */
export interface DispatchResult {
  readonly success: boolean;
  readonly providerMessageId?: string;
  readonly error?: string;
}

/**
 * Strategy interface for channel-specific delivery.
 * Each implementation handles content transformation and provider invocation.
 * The Deliver handler owns orchestration (attempt creation, persistence, retry).
 */
export interface IChannelDispatcher {
  readonly channel: Channel;
  dispatch(input: DispatchInput): Promise<DispatchResult>;
}

/** Default email HTML wrapper. */
const DEFAULT_EMAIL_WRAPPER = `<!DOCTYPE html>
<html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>{{title}}</h2>
  <div>{{body}}</div>
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
  <p style="color: #999; font-size: 12px;">This is an automated message from D2-WORX.
  {{unsubscribeUrl}}</p>
</body></html>`;

/**
 * Email channel dispatcher.
 * Renders markdown to sanitized HTML, wraps in email template, sends via provider.
 */
export class EmailDispatcher implements IChannelDispatcher {
  readonly channel: Channel = "email";
  private readonly provider: IEmailProvider;
  private readonly emailWrapper: string;

  constructor(provider: IEmailProvider, emailWrapper?: string) {
    this.provider = provider;
    this.emailWrapper = emailWrapper ?? DEFAULT_EMAIL_WRAPPER;
  }

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    let renderedBody: string;
    try {
      renderedBody = renderMarkdownToHtml(input.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown rendering error";
      return { success: false, error: `Markdown rendering failed: ${message}` };
    }

    const html = renderTemplate(this.emailWrapper, {
      title: input.title,
      body: renderedBody,
      unsubscribeUrl: "",
    });

    const sendInput: SendEmailInput = {
      to: input.address,
      subject: input.title,
      html,
      plainText: input.plainTextContent,
    };

    const sendResult = await this.provider.handleAsync(sendInput);

    if (sendResult.success && sendResult.data) {
      return { success: true, providerMessageId: sendResult.data.providerMessageId };
    }
    return { success: false, error: sendResult.messages?.join("; ") ?? "Email send failed" };
  }
}

/**
 * SMS channel dispatcher.
 * Sends plaintext content via SMS provider.
 */
export class SmsDispatcher implements IChannelDispatcher {
  readonly channel: Channel = "sms";
  private readonly provider: ISmsProvider;

  constructor(provider: ISmsProvider) {
    this.provider = provider;
  }

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const sendResult = await this.provider.handleAsync({
      to: input.address,
      body: input.plainTextContent,
    });

    if (sendResult.success && sendResult.data) {
      return { success: true, providerMessageId: sendResult.data.providerMessageId };
    }
    return { success: false, error: sendResult.messages?.join("; ") ?? "SMS send failed" };
  }
}

/** Simple {{key}} template interpolation. */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Renders markdown to sanitized HTML using `marked` + `isomorphic-dompurify`.
 */
function renderMarkdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml);
}
