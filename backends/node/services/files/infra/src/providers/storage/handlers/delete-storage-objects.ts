import { DeleteObjectsCommand, type S3Client } from "@aws-sdk/client-s3";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  DeleteStorageObjectsInput as I,
  DeleteStorageObjectsOutput as O,
  IDeleteStorageObjects,
} from "@d2/files-app";

export class DeleteStorageObjects extends BaseHandler<I, O> implements IDeleteStorageObjects {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(s3: S3Client, bucket: string, context: IHandlerContext) {
    super(context);
    this.s3 = s3;
    this.bucket = bucket;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    if (input.keys.length === 0) {
      return D2Result.ok({ data: {} });
    }

    try {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: input.keys.map((key) => ({ Key: key })),
            Quiet: true,
          },
        }),
      );
      return D2Result.ok({ data: {} });
    } catch (err: unknown) {
      this.context.logger.error("DeleteStorageObjects failed", {
        keyCount: input.keys.length,
        err,
      });
      return D2Result.serviceUnavailable();
    }
  }
}
