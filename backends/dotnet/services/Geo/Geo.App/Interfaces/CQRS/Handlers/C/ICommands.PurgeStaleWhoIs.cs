// -----------------------------------------------------------------------
// <copyright file="ICommands.PurgeStaleWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.C;

using D2.Shared.Handler;

public partial interface ICommands
{
    /// <summary>
    /// Handler for the stale WhoIs record purge job.
    /// Acquires a distributed lock, deletes stale WhoIs records, then releases the lock.
    /// </summary>
    public interface IPurgeStaleWhoIsHandler
        : IHandler<PurgeStaleWhoIsInput, PurgeStaleWhoIsOutput>;

    /// <summary>
    /// Input for the stale WhoIs purge job (no parameters needed).
    /// </summary>
    public record PurgeStaleWhoIsInput;

    /// <summary>
    /// Output for the stale WhoIs purge job.
    /// </summary>
    ///
    /// <param name="RowsAffected">
    /// The number of stale WhoIs records deleted.
    /// </param>
    /// <param name="LockAcquired">
    /// Whether the distributed lock was acquired (false means another instance is handling it).
    /// </param>
    /// <param name="DurationMs">
    /// The execution duration in milliseconds.
    /// </param>
    public record PurgeStaleWhoIsOutput(int RowsAffected, bool LockAcquired, long DurationMs);
}
