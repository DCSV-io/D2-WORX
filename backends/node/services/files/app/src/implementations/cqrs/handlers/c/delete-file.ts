import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { z } from "zod";
import { Commands } from "../../../../interfaces/cqrs/handlers/index.js";
import type { FileRepoHandlers } from "../../../../interfaces/repository/handlers/index.js";
import type { FileStorageHandlers } from "../../../../interfaces/providers/storage/handlers/index.js";
import { buildRawStorageKey, buildVariantStorageKey } from "../../../utils/storage-keys.js";

type Input = Commands.DeleteFileInput;
type Output = Commands.DeleteFileOutput;

const schema = z.object({
  fileId: z.string().min(1).max(255),
});

/**
 * Deletes a file: removes all MinIO objects (raw + variants) then deletes the DB record.
 */
export class DeleteFile extends BaseHandler<Input, Output> implements Commands.IDeleteFileHandler {
  private readonly repo: FileRepoHandlers;
  private readonly storage: FileStorageHandlers;

  constructor(repo: FileRepoHandlers, storage: FileStorageHandlers, context: IHandlerContext) {
    super(context);
    this.repo = repo;
    this.storage = storage;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const findResult = await this.repo.findById.handleAsync({ id: input.fileId });
    if (!findResult.success) return D2Result.bubbleFail(findResult);
    if (!findResult.data?.file) return D2Result.notFound();

    const file = findResult.data.file;

    // Collect all storage keys to delete
    const keysToDelete: string[] = [buildRawStorageKey(file)];
    if (file.variants) {
      for (const variant of file.variants) {
        keysToDelete.push(buildVariantStorageKey(file, variant.size, variant.contentType));
      }
    }

    // Delete from storage (silently ignores missing keys)
    const deleteResult = await this.storage.deleteMany.handleAsync({ keys: keysToDelete });
    if (!deleteResult.success) return D2Result.bubbleFail(deleteResult);

    // Delete DB record
    const repoDeleteResult = await this.repo.delete.handleAsync({ id: file.id });
    if (!repoDeleteResult.success) return D2Result.bubbleFail(repoDeleteResult);

    return D2Result.ok({ data: {} });
  }
}
