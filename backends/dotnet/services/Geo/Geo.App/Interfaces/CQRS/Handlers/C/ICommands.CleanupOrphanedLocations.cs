// -----------------------------------------------------------------------
// <copyright file="ICommands.CleanupOrphanedLocations.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.C;

using D2.Shared.Handler;

public partial interface ICommands
{
    /// <summary>
    /// Handler for the orphaned location cleanup job.
    /// Acquires a distributed lock, deletes orphaned locations, then releases the lock.
    /// </summary>
    public interface ICleanupOrphanedLocationsHandler
        : IHandler<CleanupOrphanedLocationsInput, CleanupOrphanedLocationsOutput>;

    /// <summary>
    /// Input for the orphaned location cleanup job (no parameters needed).
    /// </summary>
    public record CleanupOrphanedLocationsInput;

    /// <summary>
    /// Output for the orphaned location cleanup job.
    /// </summary>
    ///
    /// <param name="RowsAffected">
    /// The number of orphaned locations deleted.
    /// </param>
    /// <param name="LockAcquired">
    /// Whether the distributed lock was acquired (false means another instance is handling it).
    /// </param>
    /// <param name="DurationMs">
    /// The execution duration in milliseconds.
    /// </param>
    public record CleanupOrphanedLocationsOutput(int RowsAffected, bool LockAcquired, long DurationMs);
}
