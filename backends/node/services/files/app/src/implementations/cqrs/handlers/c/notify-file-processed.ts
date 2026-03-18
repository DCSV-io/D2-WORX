import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { z } from "zod";
import type { Commands } from "../../../../interfaces/cqrs/handlers/index.js";
import type { IOutboundRequest } from "../../../../interfaces/providers/outbound/handlers/outbound-request.js";

type Input = Commands.NotifyFileProcessedInput;
type Output = Commands.NotifyFileProcessedOutput;

const schema = z.object({
  url: z.string().min(1).max(2048),
  fileId: z.string().min(1).max(255),
  contextKey: z.string().min(1).max(255),
  relatedEntityId: z.string().min(1).max(255),
  status: z.enum(["ready", "rejected"]),
  variants: z.array(z.any()).optional(),
});

/**
 * Notifies the owning service that file processing completed.
 * Delegates to IOutboundRequest for transport (gRPC/HTTP decided by infra).
 */
export class NotifyFileProcessed
  extends BaseHandler<Input, Output>
  implements Commands.INotifyFileProcessedHandler
{
  private readonly outbound: IOutboundRequest;

  constructor(outbound: IOutboundRequest, context: IHandlerContext) {
    super(context);
    this.outbound = outbound;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const payload: Record<string, unknown> = {
      fileId: input.fileId,
      contextKey: input.contextKey,
      relatedEntityId: input.relatedEntityId,
      status: input.status,
    };

    if (input.variants) {
      payload.variants = input.variants;
    }

    const result = await this.outbound.handleAsync({
      url: input.url,
      payload,
    });
    if (!result.success) return D2Result.bubbleFail(result);

    return D2Result.ok({ data: { success: true } });
  }
}
