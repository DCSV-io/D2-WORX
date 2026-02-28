// -----------------------------------------------------------------------
// <copyright file="CleanupOrphanedLocations.cs" company="DCSV">
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
using H = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.ICleanupOrphanedLocationsHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.CleanupOrphanedLocationsInput;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.CleanupOrphanedLocationsOutput;
using RepoDelete = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete;

/// <summary>
/// Job handler for cleaning up orphaned locations.
/// Acquires a distributed lock, deletes orphaned locations, then releases the lock.
/// </summary>
public class CleanupOrphanedLocations : BaseHandler<CleanupOrphanedLocations, I, O>, H
{
    private const string _LOCK_KEY = "lock:job:cleanup-orphaned-locations";

    private readonly CacheLock.IAcquireLockHandler r_acquireLock;
    private readonly CacheUnlock.IReleaseLockHandler r_releaseLock;
    private readonly RepoDelete.IDeleteOrphanedLocationsHandler r_deleteOrphanedLocations;
    private readonly GeoAppOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="CleanupOrphanedLocations"/> class.
    /// </summary>
    ///
    /// <param name="acquireLock">
    /// The handler for acquiring a distributed lock.
    /// </param>
    /// <param name="releaseLock">
    /// The handler for releasing a distributed lock.
    /// </param>
    /// <param name="deleteOrphanedLocations">
    /// The repository handler for deleting orphaned locations.
    /// </param>
    /// <param name="options">
    /// Application options (includes job settings).
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public CleanupOrphanedLocations(
        CacheLock.IAcquireLockHandler acquireLock,
        CacheUnlock.IReleaseLockHandler releaseLock,
        RepoDelete.IDeleteOrphanedLocationsHandler deleteOrphanedLocations,
        IOptions<GeoAppOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_acquireLock = acquireLock;
        r_releaseLock = releaseLock;
        r_deleteOrphanedLocations = deleteOrphanedLocations;
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
            Context.Logger.LogWarning(
                "Failed to acquire lock for orphaned location cleanup (Redis error). TraceId: {TraceId}.",
                TraceId);
            return D2Result<O?>.Ok(new O(RowsAffected: 0, LockAcquired: false, DurationMs: sw.ElapsedMilliseconds));
        }

        if (!lockResult.Data!.Acquired)
        {
            Context.Logger.LogInformation(
                "Lock not acquired for orphaned location cleanup — another instance is handling it. TraceId: {TraceId}.",
                TraceId);
            return D2Result<O?>.Ok(new O(RowsAffected: 0, LockAcquired: false, DurationMs: sw.ElapsedMilliseconds));
        }

        try
        {
            // Execute cleanup.
            var deleteResult = await r_deleteOrphanedLocations.HandleAsync(
                new(), ct);

            if (deleteResult.Failed)
            {
                return D2Result<O?>.BubbleFail(deleteResult);
            }

            var rowsAffected = deleteResult.Data!.RowsAffected;

            Context.Logger.LogInformation(
                "Orphaned location cleanup completed. RowsAffected: {RowsAffected}, DurationMs: {DurationMs}. TraceId: {TraceId}.",
                rowsAffected,
                sw.ElapsedMilliseconds,
                TraceId);

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
                Context.Logger.LogWarning(
                    "Failed to release lock for orphaned location cleanup. LockId: {LockId}. TraceId: {TraceId}.",
                    lockId,
                    TraceId);
            }
        }
    }
}
