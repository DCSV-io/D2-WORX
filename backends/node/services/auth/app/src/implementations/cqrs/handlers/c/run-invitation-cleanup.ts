import { randomUUID } from "node:crypto";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";
import type { IPurgeExpiredInvitationsHandler } from "../../../../interfaces/repository/handlers/d/purge-expired-invitations.js";
import type { AuthJobOptions } from "../../../../auth-job-options.js";

const LOCK_KEY = "lock:job:cleanup-expired-invitations";

export interface RunInvitationCleanupInput {}

export interface RunInvitationCleanupOutput {
  readonly rowsAffected: number;
  readonly lockAcquired: boolean;
  readonly durationMs: number;
}

export class RunInvitationCleanup extends BaseHandler<
  RunInvitationCleanupInput,
  RunInvitationCleanupOutput
> {
  private readonly acquireLock: DistributedCache.IAcquireLockHandler;
  private readonly releaseLock: DistributedCache.IReleaseLockHandler;
  private readonly purge: IPurgeExpiredInvitationsHandler;
  private readonly options: AuthJobOptions;

  constructor(
    acquireLock: DistributedCache.IAcquireLockHandler,
    releaseLock: DistributedCache.IReleaseLockHandler,
    purge: IPurgeExpiredInvitationsHandler,
    options: AuthJobOptions,
    context: IHandlerContext,
  ) {
    super(context);
    this.acquireLock = acquireLock;
    this.releaseLock = releaseLock;
    this.purge = purge;
    this.options = options;
  }

  protected async executeAsync(
    _input: RunInvitationCleanupInput,
  ): Promise<D2Result<RunInvitationCleanupOutput | undefined>> {
    const start = performance.now();
    const lockId = randomUUID();

    const lockResult = await this.acquireLock.handleAsync({
      key: LOCK_KEY,
      lockId,
      expirationMs: this.options.lockTtlMs,
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
      cutoffDate.setDate(cutoffDate.getDate() - this.options.invitationRetentionDays);

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
