// -----------------------------------------------------------------------
// <copyright file="IUpdate.SetMany.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.Caching.InMemory.Handlers.U;

using D2.Contracts.Handler;

public partial interface IUpdate
{
    /// <summary>
    /// Handler for setting multiple values in the cache.
    /// </summary>
    ///
    /// <typeparam name="TValue">
    /// The type of the values to cache.
    /// </typeparam>
    public interface ISetManyHandler<TValue> : IHandler<SetManyInput<TValue>, SetManyOutput>;

    /// <summary>
    /// Input for setting multiple values in the cache.
    /// </summary>
    ///
    /// <param name="Values">
    /// A dictionary containing the keys and their corresponding values to store in the cache.
    /// </param>
    /// <param name="Expiration">
    /// The optional expiration time for the cached items.
    /// </param>
    ///
    /// <typeparam name="TValue">
    /// The type of the values to cache.
    /// </typeparam>
    public record SetManyInput<TValue>(
        Dictionary<string, TValue> Values,
        TimeSpan? Expiration = null);

    /// <summary>
    /// Output for setting multiple values in the cache.
    /// </summary>
    public record SetManyOutput;
}
