// -----------------------------------------------------------------------
// <copyright file="ICommonCacheService.Remove.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.CommonCacheService;

using D2.Contracts.Handler;

public partial interface ICommonCacheService
{
    /// <summary>
    /// Handler for removing a value from the cache.
    /// </summary>
    public interface IRemoveHandler : IHandler<RemoveInput, RemoveOutput>;

    /// <summary>
    /// Input for removing a value from the cache.
    /// </summary>
    ///
    /// <param name="Key">
    /// The key of the cached item to remove.
    /// </param>
    public record RemoveInput(string Key);

    /// <summary>
    /// Output for removing a value from the cache.
    /// </summary>
    public record RemoveOutput;
}
