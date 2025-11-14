// -----------------------------------------------------------------------
// <copyright file="ICommonCacheService.Get.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.CommonCacheService;

using D2.Contracts.Handler;

/// <inheritdoc cref="ICommonCacheService"/>
public partial interface ICommonCacheService
{
    /// <summary>
    /// Handler for getting a value from the cache.
    /// </summary>
    ///
    /// <typeparam name="TValue">
    /// The type of the cached value.
    /// </typeparam>
    public interface IGetHandler<TValue> : IHandler<GetInput, GetOutput<TValue>>;

    /// <summary>
    /// Gets a handler for retrieving a value of type <typeparamref name="TValue"/> from the cache.
    /// </summary>
    ///
    /// <typeparam name="TValue">
    /// The type of the cached value.
    /// </typeparam>
    ///
    /// <returns>
    /// An instance of <see cref="IGetHandler{TValue}"/> for retrieving the cached value.
    /// </returns>
    public IGetHandler<TValue> Get<TValue>();

    /// <summary>
    /// Input for getting a value from the cache.
    /// </summary>
    ///
    /// <param name="Key">
    /// The key of the cached item to retrieve.
    /// </param>
    public record GetInput(string Key);

    /// <summary>
    /// Output for getting a value from the cache.
    /// </summary>
    ///
    /// <param name="Value">
    /// The retrieved value, or null if the key does not exist.
    /// </param>
    ///
    /// <typeparam name="TValue">
    /// The type of the cached value.
    /// </typeparam>
    public record GetOutput<TValue>(TValue? Value);
}
