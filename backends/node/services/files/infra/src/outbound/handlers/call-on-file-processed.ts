import * as grpc from "@grpc/grpc-js";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import {
  FileCallbackClientCtor,
  type FileCallbackClient,
  type FileProcessedResponse,
} from "@d2/protos";
import { createTraceContextInterceptor } from "@d2/service-defaults/grpc";
import type {
  CallOnFileProcessedInput as I,
  CallOnFileProcessedOutput as O,
  ICallOnFileProcessed,
} from "@d2/files-app";

const GRPC_TIMEOUT_MS = 10_000;

/**
 * gRPC outbound client for OnFileProcessed calls to owning services.
 *
 * Manages a connection cache keyed by address — creates a new gRPC channel
 * on first call to a given address, reuses thereafter.
 */
export class CallOnFileProcessed extends BaseHandler<I, O> implements ICallOnFileProcessed {
  private readonly clients: Map<string, FileCallbackClient>;

  constructor(clients: Map<string, FileCallbackClient>, context: IHandlerContext) {
    super(context);
    this.clients = clients;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const client = this.getOrCreateClient(input.address);

    try {
      const response = await new Promise<FileProcessedResponse>((resolve, reject) => {
        client.onFileProcessed(
          {
            fileId: input.fileId,
            contextKey: input.contextKey,
            relatedEntityId: input.relatedEntityId,
            status: input.status,
            variants: input.variants ? [...input.variants] : [],
          },
          new grpc.Metadata(),
          { deadline: Date.now() + GRPC_TIMEOUT_MS },
          (err, res) => {
            if (err) reject(err);
            else resolve(res);
          },
        );
      });

      return D2Result.ok({ data: { success: response.success } });
    } catch (err: unknown) {
      this.context.logger.error("CallOnFileProcessed gRPC call failed", {
        address: input.address,
        fileId: input.fileId,
        err,
      });
      return D2Result.serviceUnavailable();
    }
  }

  private getOrCreateClient(address: string): FileCallbackClient {
    let client = this.clients.get(address);
    if (!client) {
      client = new FileCallbackClientCtor(address, grpc.credentials.createInsecure(), {
        interceptors: [createTraceContextInterceptor()],
      }) as unknown as FileCallbackClient;
      this.clients.set(address, client);
    }
    return client;
  }
}
