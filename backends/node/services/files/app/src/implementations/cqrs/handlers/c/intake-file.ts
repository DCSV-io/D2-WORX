import { BaseHandler, type IHandlerContext, type RedactionSpec } from "@d2/handler";
import { D2Result } from "@d2/result";
import { z } from "zod";
import { transitionFileStatus } from "@d2/files-domain";
import { Commands } from "../../../../interfaces/cqrs/handlers/index.js";
import type { FileRepoHandlers } from "../../../../interfaces/repository/handlers/index.js";
import type { FileStorageHandlers } from "../../../../interfaces/providers/storage/handlers/index.js";
import { buildRawStorageKey } from "../../../utils/storage-keys.js";

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
 *
 * Also verifies actual upload size matches declared size — S3 presigned
 * PUT URLs cannot enforce Content-Length, so post-upload verification
 * is required to prevent size bypass.
 */
export class IntakeFile extends BaseHandler<Input, Output> implements Commands.IIntakeFileHandler {
  override get redaction(): RedactionSpec {
    return { suppressOutput: true };
  }

  private readonly repo: FileRepoHandlers;
  private readonly storage: Pick<FileStorageHandlers, "head" | "delete">;

  constructor(
    repo: FileRepoHandlers,
    storage: Pick<FileStorageHandlers, "head" | "delete">,
    context: IHandlerContext,
  ) {
    super(context);
    this.repo = repo;
    this.storage = storage;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const findResult = await this.repo.findById.handleAsync({ id: input.fileId });
    if (!findResult.success || !findResult.data?.file) {
      return D2Result.ok({ data: { discarded: true, reason: "not_found" } });
    }

    const file = findResult.data.file;

    // Verify actual upload size matches declared size (S3 presigned URLs can't enforce Content-Length)
    const headResult = await this.storage.head.handleAsync({
      key: buildRawStorageKey(file),
    });
    if (headResult.success && headResult.data) {
      const actualSize = headResult.data.sizeBytes;
      if (actualSize !== undefined && actualSize > file.sizeBytes) {
        // Actual upload exceeds declared size — reject and clean up
        this.context.logger.warn("Upload size mismatch", {
          fileId: input.fileId,
          declaredSize: file.sizeBytes,
          actualSize,
        });
        await this.storage.delete.handleAsync({
          key: buildRawStorageKey(file),
        });
        const rejectedFile = transitionFileStatus(file, "rejected", {
          rejectionReason: "size_mismatch",
        });
        await this.repo.update.handleAsync({ file: rejectedFile });
        return D2Result.ok({ data: { discarded: true, reason: "size_mismatch" } });
      }
    }

    if (file.status !== "pending") {
      return D2Result.ok({ data: { discarded: true, reason: "wrong_status" } });
    }

    const processingFile = transitionFileStatus(file, "processing");

    const updateResult = await this.repo.update.handleAsync({
      file: processingFile,
      expectedStatus: "pending",
    });
    if (!updateResult.success) {
      if (updateResult.statusCode === 404) {
        return D2Result.ok({ data: { discarded: true, reason: "concurrent_transition" } });
      }
      return D2Result.bubbleFail(updateResult);
    }

    return D2Result.ok({ data: { discarded: false, file: processingFile } });
  }
}
