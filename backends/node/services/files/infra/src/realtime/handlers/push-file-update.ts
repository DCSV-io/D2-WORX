import * as grpc from "@grpc/grpc-js";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import {
  SignalRBridgeClientCtor,
  type SignalRBridgeClient,
  type PushToUserResponse,
} from "@d2/protos";
import { createTraceContextInterceptor } from "@d2/service-defaults/grpc";
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
 * `SignalRBridge.PushToUser` RPC on the gateway.
 */
export class PushFileUpdate extends BaseHandler<I, O> implements IPushFileUpdate {
  private readonly gatewayAddress: string;
  private client: SignalRBridgeClient | undefined;

  constructor(gatewayAddress: string, context: IHandlerContext) {
    super(context);
    this.gatewayAddress = gatewayAddress;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const client = this.getOrCreateClient();
    const event = input.status === "ready" ? "file:ready" : "file:rejected";

    const payload = JSON.stringify({
      fileId: input.fileId,
      contextKey: input.contextKey,
      status: input.status,
      rejectionReason: input.rejectionReason,
      variants: input.variants,
    });

    try {
      const response = await new Promise<PushToUserResponse>((resolve, reject) => {
        client.pushToUser(
          {
            targetUserId: input.userId,
            event,
            payloadJson: payload,
          },
          new grpc.Metadata(),
          { deadline: Date.now() + GRPC_TIMEOUT_MS },
          (err, res) => {
            if (err) reject(err);
            else resolve(res);
          },
        );
      });

      return D2Result.ok({ data: { delivered: response.delivered } });
    } catch (err: unknown) {
      this.context.logger.error("PushFileUpdate gRPC call failed", {
        gatewayAddress: this.gatewayAddress,
        userId: input.userId,
        fileId: input.fileId,
        err,
      });
      return D2Result.serviceUnavailable();
    }
  }

  private getOrCreateClient(): SignalRBridgeClient {
    if (!this.client) {
      this.client = new SignalRBridgeClientCtor(
        this.gatewayAddress,
        grpc.credentials.createInsecure(),
        { interceptors: [createTraceContextInterceptor()] },
      ) as unknown as SignalRBridgeClient;
    }
    return this.client;
  }
}
