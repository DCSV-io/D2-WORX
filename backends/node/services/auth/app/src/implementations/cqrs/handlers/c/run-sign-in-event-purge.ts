import { randomUUID } from "node:crypto";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";
import type { IPurgeSignInEventsHandler } from "../../../../interfaces/repository/handlers/d/purge-sign-in-events.js";
import type { AuthJobOptions } from "../../../../auth-job-options.js";
import { Commands } from "../../../../interfaces/cqrs/handlers/index.js";

type Input = Commands.RunSignInEventPurgeInput;
type Output = Commands.RunSignInEventPurgeOutput;

const LOCK_KEY = "lock:job:purge-sign-in-events";

export class RunSignInEventPurge
  extends BaseHandler<Input, Output>
  implements Commands.IRunSignInEventPurgeHandler
{
  private readonly acquireLock: DistributedCache.IAcquireLockHandler;
  private readonly releaseLock: DistributedCache.IReleaseLockHandler;
  private readonly purge: IPurgeSignInEventsHandler;
  private readonly options: AuthJobOptions;

  constructor(
    acquireLock: DistributedCache.IAcquireLockHandler,
    releaseLock: DistributedCache.IReleaseLockHandler,
    purge: IPurgeSignInEventsHandler,
    options: AuthJobOptions,
    context: IHandlerContext,
  ) {
    super(context);
    this.acquireLock = acquireLock;
    this.releaseLock = releaseLock;
    this.purge = purge;
    this.options = options;
  }

  protected async executeAsync(_input: Input): Promise<D2Result<Output | undefined>> {
    const start = performance.now();
    const lockId = randomUUID();

    const lockResult = await this.acquireLock.handleAsync({
      key: LOCK_KEY,
      lockId,
      expirationMs: this.options.jobLockTtlMs,
    });

    if (!lockResult.success || !lockResult.data?.acquired) {
      return D2Result.ok({
        data: {
          rowsAffected: 0,
          lockAcquired: false,
          durationMs: Math.round(performance.now() - start),
        },
      });
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.signInEventRetentionDays);

      const result = await this.purge.handleAsync({ cutoffDate });

      if (!result.success) {
        return D2Result.bubbleFail(result);
      }

      return D2Result.ok({
        data: {
          rowsAffected: result.data?.rowsAffected ?? 0,
          lockAcquired: true,
          durationMs: Math.round(performance.now() - start),
        },
      });
    } finally {
      await this.releaseLock.handleAsync({ key: LOCK_KEY, lockId });
    }
  }
}

export type {
  RunSignInEventPurgeInput,
  RunSignInEventPurgeOutput,
} from "../../../../interfaces/cqrs/handlers/c/run-sign-in-event-purge.js";
