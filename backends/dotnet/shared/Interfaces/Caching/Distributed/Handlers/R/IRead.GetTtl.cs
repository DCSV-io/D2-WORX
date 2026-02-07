// -----------------------------------------------------------------------
// <copyright file="IRead.GetTtl.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Caching.Distributed.Handlers.R;

using D2.Shared.Handler;

public partial interface IRead
{
    /// <summary>
    /// Handler for getting the time-to-live of a cached key.
    /// </summary>
    public interface IGetTtlHandler : IHandler<GetTtlInput, GetTtlOutput>;

    /// <summary>
    /// Input for getting the time-to-live of a cached key.
    /// </summary>
    ///
    /// <param name="Key">
    /// The key to check the TTL for.
    /// </param>
    public record GetTtlInput(string Key);

    /// <summary>
    /// Output for getting the time-to-live of a cached key.
    /// </summary>
    ///
    /// <param name="TimeToLive">
    /// The remaining time-to-live, or null if the key does not exist or has no expiration.
    /// </param>
    public record GetTtlOutput(TimeSpan? TimeToLive);
}
