import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result, HttpStatusCode } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import { GeoRefData as GeoRefDataCodec } from "@d2/protos";
import { GEO_REF_DATA_FILE_NAME } from "@d2/utilities";
import type { GeoClientOptions } from "../../geo-client-options.js";

export interface SetOnDiskInput {
  data: GeoRefData;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetOnDiskOutput {}

/**
 * Handler for persisting georeference data to disk as protobuf binary.
 * Mirrors D2.Geo.Client.CQRS.Handlers.C.SetOnDisk in .NET.
 */
export class SetOnDisk extends BaseHandler<SetOnDiskInput, SetOnDiskOutput> {
  private readonly filePath: string;

  constructor(options: GeoClientOptions, context: IHandlerContext) {
    super(context);
    this.filePath = join(options.dataDir, GEO_REF_DATA_FILE_NAME);
  }

  protected async executeAsync(
    input: SetOnDiskInput,
  ): Promise<D2Result<SetOnDiskOutput | undefined>> {
    try {
      const bytes = GeoRefDataCodec.encode(input.data).finish();
      await mkdir(join(this.filePath, ".."), { recursive: true });
      await writeFile(this.filePath, bytes);
      return D2Result.ok({ data: {}, traceId: this.traceId });
    } catch {
      this.context.logger.error(
        `IOException occurred while writing georeference data to disk. TraceId: ${this.traceId}`,
      );
      return D2Result.fail({
        messages: ["Unable to write to disk."],
        statusCode: HttpStatusCode.InternalServerError,
        traceId: this.traceId,
      });
    }
  }
}
