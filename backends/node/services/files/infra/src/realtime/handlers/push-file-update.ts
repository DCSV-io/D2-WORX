import * as grpc from "@grpc/grpc-js";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import type { D2Result } from "@d2/result";
import {
  RealtimeGatewayClientCtor,
  type RealtimeGatewayClient,
  type RealtimePushResponse,
} from "@d2/protos";
import { handleGrpcCall } from "@d2/result-extensions";
import { createApiKeyInterceptor, createTraceContextInterceptor } from "@d2/service-defaults/grpc";
import {
  type PushFileUpdateInput as I,
  type PushFileUpdateOutput as O,
  type IPushFileUpdate,
} from "@d2/files-app";

const GRPC_TIMEOUT_MS = 10_000;

/**
 * Pushes file processing updates to connected browser clients via the SignalR Gateway.
 *
 * Serializes the file-specific payload to JSON and calls the generic
 * `RealtimeGateway.PushToChannel` RPC on the gateway.
 * Channel = `user:{uploaderUserId}` — files always push to the uploader.
 */
export class PushFileUpdate extends BaseHandler<I, O> implements IPushFileUpdate {
  private readonly gatewayAddress: string;
  private readonly apiKey: string;
  private client: RealtimeGatewayClient | undefined;

  constructor(gatewayAddress: string, apiKey: string, context: IHandlerContext) {
    super(context);
    this.gatewayAddress = gatewayAddress;
    this.apiKey = apiKey;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const client = this.getOrCreateClient();
    const event = input.status === "ready" ? "file:ready" : "file:rejected";
    const channel = `user:${input.uploaderUserId}`;

    const payload = JSON.stringify({
      fileId: input.fileId,
      contextKey: input.contextKey,
      status: input.status,
      rejectionReason: input.rejectionReason,
      variants: input.variants,
    });

    return handleGrpcCall(
      () =>
        new Promise<RealtimePushResponse>((resolve, reject) => {
          client.pushToChannel(
            {
              channel,
              event,
              payloadJson: payload,
            },
            new grpc.Metadata(),
            { deadline: Date.now() + GRPC_TIMEOUT_MS },
            (err: grpc.ServiceError | null, res: RealtimePushResponse) => {
              if (err) reject(err);
              else resolve(res);
            },
          );
        }),
      (res) => res.result!,
      (res) => ({ delivered: res.delivered ?? false }),
    );
  }

  private getOrCreateClient(): RealtimeGatewayClient {
    if (!this.client) {
      this.client = new RealtimeGatewayClientCtor(
        this.gatewayAddress,
        grpc.credentials.createInsecure(),
        {
          interceptors: [createTraceContextInterceptor(), createApiKeyInterceptor(this.apiKey)],
        },
      ) as unknown as RealtimeGatewayClient;
    }
    return this.client;
  }
}
