// -----------------------------------------------------------------------
// <copyright file="ICreate.AcquireLock.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Caching.Distributed.Handlers.C;

using D2.Shared.Handler;

public partial interface ICreate
{
    /// <summary>
    /// Handler for acquiring a distributed lock (SET NX with mandatory TTL).
    /// </summary>
    public interface IAcquireLockHandler : IHandler<AcquireLockInput, AcquireLockOutput>;

    /// <summary>
    /// Input for acquiring a distributed lock.
    /// </summary>
    ///
    /// <param name="Key">
    /// The lock key identifying the resource to lock.
    /// </param>
    /// <param name="LockId">
    /// A unique identifier for the lock owner (typically a UUID).
    /// </param>
    /// <param name="Expiration">
    /// The mandatory expiration time for the lock. Locks without TTL are not permitted.
    /// </param>
    public record AcquireLockInput(string Key, string LockId, TimeSpan Expiration);

    /// <summary>
    /// Output for acquiring a distributed lock.
    /// </summary>
    ///
    /// <param name="Acquired">
    /// Indicates whether the lock was acquired (true) or was already held (false).
    /// </param>
    public record AcquireLockOutput(bool Acquired);
}
