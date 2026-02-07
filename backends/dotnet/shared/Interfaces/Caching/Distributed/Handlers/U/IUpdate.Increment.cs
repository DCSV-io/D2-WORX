// -----------------------------------------------------------------------
// <copyright file="IUpdate.Increment.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Caching.Distributed.Handlers.U;

using D2.Shared.Handler;

public partial interface IUpdate
{
    /// <summary>
    /// Handler for atomically incrementing a counter in the cache.
    /// </summary>
    public interface IIncrementHandler : IHandler<IncrementInput, IncrementOutput>;

    /// <summary>
    /// Input for atomically incrementing a counter.
    /// </summary>
    ///
    /// <param name="Key">
    /// The key of the counter to increment.
    /// </param>
    /// <param name="Amount">
    /// The amount to increment by. Defaults to 1.
    /// </param>
    /// <param name="Expiration">
    /// Optional expiration time for the key. Applied after increment.
    /// </param>
    public record IncrementInput(string Key, long Amount = 1, TimeSpan? Expiration = null);

    /// <summary>
    /// Output for atomically incrementing a counter.
    /// </summary>
    ///
    /// <param name="NewValue">
    /// The new value of the counter after incrementing.
    /// </param>
    public record IncrementOutput(long NewValue);
}
