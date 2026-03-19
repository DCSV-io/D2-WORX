import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  PresignPutUrlInput as I,
  PresignPutUrlOutput as O,
  IPresignPutUrl,
} from "@d2/files-app";

const DEFAULT_EXPIRY_SECONDS = 900; // 15 minutes

export class PresignPutUrl extends BaseHandler<I, O> implements IPresignPutUrl {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(s3: S3Client, bucket: string, context: IHandlerContext) {
    super(context);
    this.s3 = s3;
    this.bucket = bucket;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.maxSizeBytes,
      });

      const url = await getSignedUrl(this.s3, command, {
        expiresIn: DEFAULT_EXPIRY_SECONDS,
      });

      return D2Result.ok({ data: { url } });
    } catch (err: unknown) {
      this.context.logger.error("PresignPutUrl failed", { key: input.key, err });
      return D2Result.serviceUnavailable();
    }
  }
}
