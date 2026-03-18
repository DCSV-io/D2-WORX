import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { z } from "zod";
import { transitionFileStatus } from "@d2/files-domain";
import { Commands } from "../../../../interfaces/cqrs/handlers/index.js";
import type { FileRepoHandlers } from "../../../../interfaces/repository/handlers/index.js";

type Input = Commands.IntakeFileInput;
type Output = Commands.IntakeFileOutput;

const schema = z.object({
  fileId: z.string().min(1).max(255),
});

/**
 * Intake handler — called by the MinIO bucket notification consumer.
 *
 * Validates that the file exists and is in "pending" status, then
 * transitions it to "processing". If the file is not found or in the
 * wrong status, the event is silently discarded (not an error).
 */
export class IntakeFile extends BaseHandler<Input, Output> implements Commands.IIntakeFileHandler {
  private readonly repo: FileRepoHandlers;

  constructor(repo: FileRepoHandlers, context: IHandlerContext) {
    super(context);
    this.repo = repo;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const findResult = await this.repo.findById.handleAsync({ id: input.fileId });
    if (!findResult.success || !findResult.data?.file) {
      return D2Result.ok({ data: { discarded: true, reason: "not_found" } });
    }

    const file = findResult.data.file;
    if (file.status !== "pending") {
      return D2Result.ok({ data: { discarded: true, reason: "wrong_status" } });
    }

    const processingFile = transitionFileStatus(file, "processing");

    const updateResult = await this.repo.update.handleAsync({ file: processingFile });
    if (!updateResult.success) return D2Result.bubbleFail(updateResult);

    return D2Result.ok({ data: { discarded: false, file: processingFile } });
  }
}
