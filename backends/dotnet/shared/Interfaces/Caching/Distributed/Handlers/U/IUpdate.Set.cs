// -----------------------------------------------------------------------
// <copyright file="IUpdate.Set.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Caching.Distributed.Handlers.U;

using D2.Shared.Handler;

public partial interface IUpdate
{
    /// <summary>
    /// Handler for setting a value in the cache.
    /// </summary>
    ///
    /// <typeparam name="TValue">
    /// The type of the value to cache.
    /// </typeparam>
    public interface ISetHandler<TValue> : IHandler<SetInput<TValue>, SetOutput>;

    /// <summary>
    /// Input for setting a value in the cache.
    /// </summary>
    ///
    /// <param name="Key">
    /// The key under which to store the value.
    /// </param>
    /// <param name="Value">
    /// The value to store in the cache.
    /// </param>
    /// <param name="Expiration">
    /// The optional expiration time for the cached item.
    /// </param>
    ///
    /// <typeparam name="TValue">
    /// The type of the value to cache.
    /// </typeparam>
    public record SetInput<TValue>(string Key, TValue Value, TimeSpan? Expiration = null);

    /// <summary>
    /// Output for setting a value in the cache.
    /// </summary>
    public record SetOutput;
}
