import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { z } from "zod";
import type { Queries } from "../../../../interfaces/cqrs/handlers/index.js";
import type { IOutboundRequest } from "../../../../interfaces/providers/outbound/handlers/outbound-request.js";

type Input = Queries.CheckFileAccessInput;
type Output = Queries.CheckFileAccessOutput;

const schema = z.object({
  url: z.string().min(1).max(2048),
  contextKey: z.string().min(1).max(255),
  relatedEntityId: z.string().min(1).max(255),
  requestingUserId: z.string().max(255),
  requestingOrgId: z.string().max(255),
  action: z.enum(["upload", "read"]),
});

/**
 * Checks file access by calling the owning service's authorization endpoint.
 * Delegates to IOutboundRequest for transport (gRPC/HTTP decided by infra).
 *
 * Fail-closed: missing or malformed response body → allowed: false.
 */
export class CheckFileAccess
  extends BaseHandler<Input, Output>
  implements Queries.ICheckFileAccessHandler
{
  private readonly outbound: IOutboundRequest;

  constructor(outbound: IOutboundRequest, context: IHandlerContext) {
    super(context);
    this.outbound = outbound;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const result = await this.outbound.handleAsync({
      url: input.url,
      payload: {
        contextKey: input.contextKey,
        relatedEntityId: input.relatedEntityId,
        requestingUserId: input.requestingUserId,
        requestingOrgId: input.requestingOrgId,
        action: input.action,
      },
    });
    if (!result.success) return D2Result.bubbleFail(result);

    // Fail-closed: missing or malformed body → allowed: false
    const allowed = result.data?.body?.allowed === true;

    return D2Result.ok({ data: { allowed } });
  }
}
