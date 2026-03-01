import { randomUUID } from "node:crypto";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";
import type { IPurgeDeletedMessagesHandler } from "../../../../interfaces/repository/handlers/d/purge-deleted-messages.js";
import type { CommsJobOptions } from "../../../../comms-job-options.js";

const LOCK_KEY = "lock:job:purge-deleted-messages";

export interface RunDeletedMessagePurgeInput {}

export interface RunDeletedMessagePurgeOutput {
  readonly rowsAffected: number;
  readonly lockAcquired: boolean;
  readonly durationMs: number;
}

export class RunDeletedMessagePurge extends BaseHandler<
  RunDeletedMessagePurgeInput,
  RunDeletedMessagePurgeOutput
> {
  private readonly acquireLock: DistributedCache.IAcquireLockHandler;
  private readonly releaseLock: DistributedCache.IReleaseLockHandler;
  private readonly purge: IPurgeDeletedMessagesHandler;
  private readonly options: CommsJobOptions;

  constructor(
    acquireLock: DistributedCache.IAcquireLockHandler,
    releaseLock: DistributedCache.IReleaseLockHandler,
    purge: IPurgeDeletedMessagesHandler,
    options: CommsJobOptions,
    context: IHandlerContext,
  ) {
    super(context);
    this.acquireLock = acquireLock;
    this.releaseLock = releaseLock;
    this.purge = purge;
    this.options = options;
  }

  protected async executeAsync(
    _input: RunDeletedMessagePurgeInput,
  ): Promise<D2Result<RunDeletedMessagePurgeOutput | undefined>> {
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
      cutoffDate.setDate(cutoffDate.getDate() - this.options.deletedMessageRetentionDays);

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
