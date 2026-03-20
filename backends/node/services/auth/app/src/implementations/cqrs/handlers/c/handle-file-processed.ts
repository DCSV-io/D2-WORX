import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { z } from "zod";
import { Commands } from "../../../../interfaces/cqrs/handlers/index.js";
import type { IUpdateUserImageHandler } from "../../../../interfaces/repository/handlers/u/update-user-image.js";
import type { IUpdateOrgLogoHandler } from "../../../../interfaces/repository/handlers/u/update-org-logo.js";

type Input = Commands.HandleFileProcessedInput;
type Output = Commands.HandleFileProcessedOutput;

const schema = z.object({
  fileId: z.string().min(1).max(36),
  contextKey: z.string().min(1).max(100),
  relatedEntityId: z.string().min(1).max(255),
  status: z.enum(["ready", "rejected"]),
  variants: z.array(z.string()).optional(),
});

/**
 * Handles file processing completion callbacks from the Files service.
 *
 * Routes by contextKey:
 * - `user_avatar` + ready → sets user.image = fileId
 * - `org_logo` + ready → sets organization.logo = fileId
 * - `org_document` → ack (no entity update needed)
 * - rejected → log + ack (no entity update)
 */
export class HandleFileProcessed
  extends BaseHandler<Input, Output>
  implements Commands.IHandleFileProcessedHandler
{
  private readonly updateUserImage: IUpdateUserImageHandler;
  private readonly updateOrgLogo: IUpdateOrgLogoHandler;

  constructor(
    updateUserImage: IUpdateUserImageHandler,
    updateOrgLogo: IUpdateOrgLogoHandler,
    context: IHandlerContext,
  ) {
    super(context);
    this.updateUserImage = updateUserImage;
    this.updateOrgLogo = updateOrgLogo;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    // Rejected files — log and ack. No entity update.
    if (input.status === "rejected") {
      this.context.logger.info("File rejected", {
        fileId: input.fileId,
        contextKey: input.contextKey,
        relatedEntityId: input.relatedEntityId,
      });
      return D2Result.ok({ data: { success: true } });
    }

    // Ready files — update the owning entity's image/logo field.
    switch (input.contextKey) {
      case "user_avatar": {
        const result = await this.updateUserImage.handleAsync({
          userId: input.relatedEntityId,
          image: input.fileId,
        });
        if (!result.success) return D2Result.bubbleFail(result);
        break;
      }

      case "org_logo": {
        const result = await this.updateOrgLogo.handleAsync({
          orgId: input.relatedEntityId,
          logo: input.fileId,
        });
        if (!result.success) return D2Result.bubbleFail(result);
        break;
      }

      case "org_document":
        // Documents don't have an entity field to update — just ack.
        break;

      case "thread_attachment":
        // Thread attachments are owned by Comms service — Auth has no entity to update.
        this.context.logger.info("Thread attachment callback received — no Auth action needed", {
          fileId: input.fileId,
        });
        break;

      default:
        this.context.logger.warn("Unknown context key in file callback", {
          contextKey: input.contextKey,
          fileId: input.fileId,
        });
        break;
    }

    return D2Result.ok({ data: { success: true } });
  }
}
