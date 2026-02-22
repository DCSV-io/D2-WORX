import { createTemplateWrapper, TEMPLATE_NAMES } from "@d2/comms-domain";
import type { TemplateWrapperRepoHandlers } from "@d2/comms-app";
import type { IHandlerContext } from "@d2/handler";

/**
 * Seeds default email templates on startup. Idempotent — if a template
 * with the same name+channel already exists, it is not overwritten.
 */
export async function seedDefaultTemplates(
  repo: TemplateWrapperRepoHandlers,
  _context: IHandlerContext,
): Promise<void> {
  const templates = [
    createTemplateWrapper({
      name: TEMPLATE_NAMES.EMAIL_VERIFICATION,
      channel: "email",
      subjectTemplate: "Verify your email address",
      bodyTemplate: `<!DOCTYPE html>
<html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>{{title}}</h2>
  <div>{{body}}</div>
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
  <p style="color: #999; font-size: 12px;">This is an automated message from D2-WORX.</p>
</body></html>`,
    }),
    createTemplateWrapper({
      name: TEMPLATE_NAMES.PASSWORD_RESET,
      channel: "email",
      subjectTemplate: "Reset your password",
      bodyTemplate: `<!DOCTYPE html>
<html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>{{title}}</h2>
  <div>{{body}}</div>
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
  <p style="color: #999; font-size: 12px;">This is an automated message from D2-WORX. If you didn't request this, ignore this email.</p>
</body></html>`,
    }),
    createTemplateWrapper({
      name: TEMPLATE_NAMES.INVITATION,
      channel: "email",
      subjectTemplate: "You've been invited to {{orgName}}",
      bodyTemplate: `<!DOCTYPE html>
<html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>{{title}}</h2>
  <div>{{body}}</div>
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
  <p style="color: #999; font-size: 12px;">This is an automated message from D2-WORX.</p>
</body></html>`,
    }),
  ];

  for (const template of templates) {
    const existing = await repo.findByNameAndChannel.handleAsync({
      name: template.name,
      channel: template.channel,
    });
    if (!existing.success || !existing.data?.template) {
      await repo.create.handleAsync({ template });
    }
  }
}
