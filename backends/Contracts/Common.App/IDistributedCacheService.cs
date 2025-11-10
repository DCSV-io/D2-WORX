namespace D2.Contracts.Common.App;

/// <summary>
/// Defines a contract for a distributed caching service.
/// </summary>
public interface IDistributedCacheService : ICommonCacheService
{
    #region Exists

    /// <summary>
    /// Input for checking if a key exists in the cache.
    /// </summary>
    ///
    /// <param name="Key">
    /// The key to check for existence in the cache.
    /// </param>
    record ExistsInput(string Key);

    /// <summary>
    /// Output for checking if a key exists in the cache.
    /// </summary>
    ///
    /// <param name="Exists">
    /// Indicates whether the key exists in the cache.
    /// </param>
    record ExistsOutput(bool Exists);

    /// <summary>
    /// Handler for checking if a key exists in the cache.
    /// </summary>
    interface IExistsHandler : IHandler<ExistsInput, ExistsOutput>;

    /// <summary>
    /// Gets a handler for checking if a key exists in the cache.
    /// </summary>
    ///
    /// <returns>
    /// An instance of <see cref="IExistsHandler"/> for checking key existence.
    /// </returns>
    IExistsHandler Exists();

    #endregion
}
