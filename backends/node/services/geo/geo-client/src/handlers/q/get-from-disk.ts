import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result, ErrorCodes, HttpStatusCode } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import { GeoRefData as GeoRefDataCodec } from "@d2/protos";
import { GEO_REF_DATA_FILE_NAME } from "@d2/utilities";
import type { GeoClientOptions } from "../../geo-client-options.js";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetFromDiskInput
export interface GetFromDiskInput {}

export interface GetFromDiskOutput {
  data: GeoRefData;
}

/**
 * Handler for getting georeference data from disk (protobuf binary).
 * Mirrors D2.Geo.Client.CQRS.Handlers.Q.GetFromDisk in .NET.
 */
export class GetFromDisk extends BaseHandler<GetFromDiskInput, GetFromDiskOutput> {
  private readonly filePath: string;

  constructor(options: GeoClientOptions, context: IHandlerContext) {
    super(context);
    this.filePath = join(options.dataDir, GEO_REF_DATA_FILE_NAME);
  }

  protected async executeAsync(
    _input: GetFromDiskInput,
  ): Promise<D2Result<GetFromDiskOutput | undefined>> {
    let bytes: Buffer;
    try {
      bytes = await readFile(this.filePath);
    } catch (err: unknown) {
      if (isFileNotFound(err)) {
        return D2Result.notFound({ traceId: this.traceId });
      }
      this.context.logger.error(
        `IOException occurred while reading georeference data from disk. TraceId: ${this.traceId}`,
      );
      return D2Result.fail({
        messages: ["Unable to read from disk."],
        statusCode: HttpStatusCode.InternalServerError,
        traceId: this.traceId,
      });
    }

    try {
      const data = GeoRefDataCodec.decode(bytes);
      return D2Result.ok({ data: { data }, traceId: this.traceId });
    } catch {
      this.context.logger.error(
        `Failed to parse georeference data from disk. TraceId: ${this.traceId}`,
      );
      return D2Result.fail({
        messages: ["Corrupted data on disk."],
        statusCode: HttpStatusCode.InternalServerError,
        errorCode: ErrorCodes.COULD_NOT_BE_DESERIALIZED,
        traceId: this.traceId,
      });
    }
  }
}

function isFileNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === "ENOENT";
}
