import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  IntakeFileUploadedInput as I,
  IntakeFileUploadedOutput as O,
  IIntakeFileUploadedHandler,
} from "@d2/files-app";
import type { FilesCommands } from "@d2/files-app";

/**
 * Messaging subscriber handler — invokes IntakeFile to transition
 * a pending file to processing status.
 */
export class IntakeFileUploaded extends BaseHandler<I, O> implements IIntakeFileUploadedHandler {
  private readonly intakeFile: FilesCommands.IIntakeFileHandler;

  constructor(intakeFile: FilesCommands.IIntakeFileHandler, context: IHandlerContext) {
    super(context);
    this.intakeFile = intakeFile;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const result = await this.intakeFile.handleAsync({ fileId: input.fileId });
    if (!result.success) {
      return D2Result.bubble(result);
    }
    return D2Result.ok({ data: {} });
  }
}
