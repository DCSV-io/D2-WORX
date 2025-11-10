namespace D2.Contracts.Common.App;

/// <summary>
/// Defines a contract for a common caching service.
/// </summary>
public interface ICommonCacheService
{
    #region Get

    /// <summary>
    /// Input for getting a value from the cache.
    /// </summary>
    ///
    /// <param name="Key">
    /// The key of the cached item to retrieve.
    /// </param>
    record GetInput(string Key);

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
    record GetOutput<TValue>(TValue? Value);

    /// <summary>
    /// Handler for getting a value from the cache.
    /// </summary>
    ///
    /// <typeparam name="TValue">
    /// The type of the cached value.
    /// </typeparam>
    interface IGetHandler<TValue> : IHandler<GetInput, GetOutput<TValue>>;

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
    IGetHandler<TValue> Get<TValue>();

    #endregion

    #region Set

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
    record SetInput<TValue>(string Key, TValue Value, TimeSpan? Expiration);

    /// <summary>
    /// Output for setting a value in the cache.
    /// </summary>
    record SetOutput;

    /// <summary>
    /// Handler for setting a value in the cache.
    /// </summary>
    ///
    /// <typeparam name="TValue">
    /// The type of the value to cache.
    /// </typeparam>
    interface ISetHandler<TValue> : IHandler<SetInput<TValue>, SetOutput>;

    /// <summary>
    /// Gets a handler for setting a value of type <typeparamref name="TValue"/> in the cache.
    /// </summary>
    ///
    /// <typeparam name="TValue">
    /// The type of the value to cache.
    /// </typeparam>
    ///
    /// <returns>
    /// An instance of <see cref="ISetHandler{TValue}"/> for setting the cached value.
    /// </returns>
    ISetHandler<TValue> Set<TValue>();

    #endregion

    #region Remove

    /// <summary>
    /// Input for removing a value from the cache.
    /// </summary>
    ///
    /// <param name="Key">
    /// The key of the cached item to remove.
    /// </param>
    record RemoveInput(string Key);

    /// <summary>
    /// Output for removing a value from the cache.
    /// </summary>
    record RemoveOutput;

    /// <summary>
    /// Handler for removing a value from the cache.
    /// </summary>
    interface IRemoveHandler : IHandler<RemoveInput, RemoveOutput>;

    /// <summary>
    /// Gets a handler for removing a value from the cache.
    /// </summary>
    ///
    /// <returns>
    /// An instance of <see cref="IRemoveHandler"/> for removing the cached value.
    /// </returns>
    IRemoveHandler Remove();

    #endregion
}
