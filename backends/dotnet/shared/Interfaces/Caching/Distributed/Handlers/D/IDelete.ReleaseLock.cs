// -----------------------------------------------------------------------
// <copyright file="IDelete.ReleaseLock.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Caching.Distributed.Handlers.D;

using D2.Shared.Handler;

public partial interface IDelete
{
    /// <summary>
    /// Handler for releasing a distributed lock (atomic compare-and-delete).
    /// </summary>
    public interface IReleaseLockHandler : IHandler<ReleaseLockInput, ReleaseLockOutput>;

    /// <summary>
    /// Input for releasing a distributed lock.
    /// </summary>
    ///
    /// <param name="Key">
    /// The lock key identifying the resource to unlock.
    /// </param>
    /// <param name="LockId">
    /// The unique identifier of the lock owner. Must match the value used to acquire.
    /// </param>
    public record ReleaseLockInput(string Key, string LockId);

    /// <summary>
    /// Output for releasing a distributed lock.
    /// </summary>
    ///
    /// <param name="Released">
    /// Indicates whether the lock was released (true) or was not held by this owner (false).
    /// </param>
    public record ReleaseLockOutput(bool Released);
}
