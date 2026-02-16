// -----------------------------------------------------------------------
// <copyright file="ICreate.SetNx.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Caching.Distributed.Handlers.C;

using D2.Shared.Handler;

public partial interface ICreate
{
    /// <summary>
    /// Handler for setting a value in the cache only if the key does not already exist (SET NX).
    /// </summary>
    ///
    /// <typeparam name="TValue">
    /// The type of the value to cache.
    /// </typeparam>
    public interface ISetNxHandler<TValue> : IHandler<SetNxInput<TValue>, SetNxOutput>;

    /// <summary>
    /// Input for setting a value in the cache only if the key does not already exist.
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
    public record SetNxInput<TValue>(string Key, TValue Value, TimeSpan? Expiration = null);

    /// <summary>
    /// Output for setting a value in the cache only if the key does not already exist.
    /// </summary>
    ///
    /// <param name="WasSet">
    /// Indicates whether the value was set (true) or the key already existed (false).
    /// </param>
    public record SetNxOutput(bool WasSet);
}
