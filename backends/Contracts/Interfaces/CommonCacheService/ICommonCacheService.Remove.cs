// -----------------------------------------------------------------------
// <copyright file="ICommonCacheService.Remove.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.CommonCacheService;

using D2.Contracts.Handler;

/// <inheritdoc cref="ICommonCacheService"/>
public partial interface ICommonCacheService
{
    /// <summary>
    /// Handler for removing a value from the cache.
    /// </summary>
    public interface IRemoveHandler : IHandler<RemoveInput, RemoveOutput>;

    /// <summary>
    /// Gets a handler for removing a value from the cache.
    /// </summary>
    ///
    /// <returns>
    /// An instance of <see cref="IRemoveHandler"/> for removing the cached value.
    /// </returns>
    public IRemoveHandler Remove();

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
