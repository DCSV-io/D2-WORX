// -----------------------------------------------------------------------
// <copyright file="PurgeStaleWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.C;

using System.Diagnostics;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using CacheLock = D2.Shared.Interfaces.Caching.Distributed.Handlers.C.ICreate;
using CacheUnlock = D2.Shared.Interfaces.Caching.Distributed.Handlers.D.IDelete;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.IPurgeStaleWhoIsHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsOutput;
using RepoDelete = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete;

/// <summary>
/// Job handler for purging stale WhoIs records.
/// Acquires a distributed lock, deletes WhoIs records older than the retention period,
/// then releases the lock.
/// </summary>
/// <remarks>
/// WhoIs records are content-addressable with Year/Month fields (no CreatedAt).
/// Staleness is determined by comparing Year/Month against the cutoff date
/// computed from <see cref="GeoAppOptions.WhoIsRetentionDays"/>.
/// This job should run BEFORE orphaned location cleanup, as deleting WhoIs records
/// may orphan their associated Locations.
/// </remarks>
public partial class PurgeStaleWhoIs : BaseHandler<PurgeStaleWhoIs, I, O>, H
{
    private const string _LOCK_KEY = "lock:job:purge-stale-whois";

    private readonly CacheLock.IAcquireLockHandler r_acquireLock;
    private readonly CacheUnlock.IReleaseLockHandler r_releaseLock;
    private readonly RepoDelete.IDeleteStaleWhoIsHandler r_deleteStaleWhoIs;
    private readonly GeoAppOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="PurgeStaleWhoIs"/> class.
    /// </summary>
    ///
    /// <param name="acquireLock">
    /// The handler for acquiring a distributed lock.
    /// </param>
    /// <param name="releaseLock">
    /// The handler for releasing a distributed lock.
    /// </param>
    /// <param name="deleteStaleWhoIs">
    /// The repository handler for deleting stale WhoIs records.
    /// </param>
    /// <param name="options">
    /// Application options (includes retention period and job settings).
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public PurgeStaleWhoIs(
        CacheLock.IAcquireLockHandler acquireLock,
        CacheUnlock.IReleaseLockHandler releaseLock,
        RepoDelete.IDeleteStaleWhoIsHandler deleteStaleWhoIs,
        IOptions<GeoAppOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_acquireLock = acquireLock;
        r_releaseLock = releaseLock;
        r_deleteStaleWhoIs = deleteStaleWhoIs;
        r_options = options.Value;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var lockId = Guid.CreateVersion7().ToString();
        var ttl = TimeSpan.FromSeconds(r_options.JobLockTtlSeconds);

        // Acquire distributed lock.
        var lockResult = await r_acquireLock.HandleAsync(
            new CacheLock.AcquireLockInput(_LOCK_KEY, lockId, ttl), ct);

        if (lockResult.Failed)
        {
            LogLockAcquireFailed(Context.Logger, TraceId);
            return D2Result<O?>.Ok(new O(RowsAffected: 0, LockAcquired: false, DurationMs: sw.ElapsedMilliseconds));
        }

        if (!lockResult.Data!.Acquired)
        {
            LogLockNotAcquired(Context.Logger, TraceId);
            return D2Result<O?>.Ok(new O(RowsAffected: 0, LockAcquired: false, DurationMs: sw.ElapsedMilliseconds));
        }

        try
        {
            // Compute cutoff date from retention period.
            var cutoff = DateTime.UtcNow.AddDays(-r_options.WhoIsRetentionDays);

            // Execute purge.
            var deleteResult = await r_deleteStaleWhoIs.HandleAsync(
                new RepoDelete.DeleteStaleWhoIsInput(cutoff.Year, cutoff.Month), ct);

            if (deleteResult.Failed)
            {
                return D2Result<O?>.BubbleFail(deleteResult);
            }

            var rowsAffected = deleteResult.Data!.RowsAffected;

            LogPurgeCompleted(Context.Logger, cutoff.Year, cutoff.Month, rowsAffected, sw.ElapsedMilliseconds, TraceId);

            return D2Result<O?>.Ok(new O(
                RowsAffected: rowsAffected,
                LockAcquired: true,
                DurationMs: sw.ElapsedMilliseconds));
        }
        finally
        {
            // Always release the lock.
            var releaseResult = await r_releaseLock.HandleAsync(
                new CacheUnlock.ReleaseLockInput(_LOCK_KEY, lockId), CancellationToken.None);

            if (releaseResult.Failed || !releaseResult.Data!.Released)
            {
                LogLockReleaseFailed(Context.Logger, lockId, TraceId);
            }
        }
    }

    /// <summary>
    /// Logs a warning when acquiring the distributed lock fails due to a Redis error.
    /// </summary>
    [LoggerMessage(EventId = 1, Level = LogLevel.Warning, Message = "Failed to acquire lock for stale WhoIs purge (Redis error). TraceId: {TraceId}.")]
    private static partial void LogLockAcquireFailed(ILogger logger, string? traceId);

    /// <summary>
    /// Logs that the lock was not acquired because another instance is already handling the purge.
    /// </summary>
    [LoggerMessage(EventId = 2, Level = LogLevel.Information, Message = "Lock not acquired for stale WhoIs purge — another instance is handling it. TraceId: {TraceId}.")]
    private static partial void LogLockNotAcquired(ILogger logger, string? traceId);

    /// <summary>
    /// Logs the completion of the stale WhoIs purge with cutoff date, row count, and duration.
    /// </summary>
    [LoggerMessage(EventId = 3, Level = LogLevel.Information, Message = "Stale WhoIs purge completed. CutoffYear: {CutoffYear}, CutoffMonth: {CutoffMonth}, RowsAffected: {RowsAffected}, DurationMs: {DurationMs}. TraceId: {TraceId}.")]
    private static partial void LogPurgeCompleted(ILogger logger, int cutoffYear, int cutoffMonth, int rowsAffected, long durationMs, string? traceId);

    /// <summary>
    /// Logs a warning when releasing the distributed lock fails after purge.
    /// </summary>
    [LoggerMessage(EventId = 4, Level = LogLevel.Warning, Message = "Failed to release lock for stale WhoIs purge. LockId: {LockId}. TraceId: {TraceId}.")]
    private static partial void LogLockReleaseFailed(ILogger logger, string lockId, string? traceId);
}
