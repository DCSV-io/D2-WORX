import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { Messaging } from "@d2/interfaces";
import type { MessageBus } from "../../message-bus.js";

type Input = Messaging.PingInput;
type Output = Messaging.PingOutput;

export class PingMessageBus extends BaseHandler<Input, Output> implements Messaging.IPingHandler {
  private readonly messageBus: MessageBus;

  constructor(messageBus: MessageBus, context: IHandlerContext) {
    super(context);
    this.messageBus = messageBus;
  }

  protected async executeAsync(_input: Input): Promise<D2Result<Output | undefined>> {
    const start = performance.now();
    try {
      const connected = await this.messageBus.ping();
      const latencyMs = Math.round(performance.now() - start);
      if (connected) {
        return D2Result.ok({ data: { healthy: true, latencyMs } });
      }
      return D2Result.ok({
        data: { healthy: false, latencyMs, error: "Connection not ready" },
      });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const error = err instanceof Error ? err.message : "Unknown error";
      return D2Result.ok({ data: { healthy: false, latencyMs, error } });
    }
  }
}
