// -----------------------------------------------------------------------
// <copyright file="GeoRefDataServiceTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Tests.Integration;

// ReSharper disable AccessToStaticMemberViaDerivedType
using D2.Contracts.DistributedCache.Redis;
using D2.Contracts.GeoRefDataService.Default;
using D2.Contracts.Handler;
using D2.Contracts.Interfaces.DistributedCacheService;
using D2.Contracts.Interfaces.GeoRefDataService;
using D2.Contracts.MemoryCache.Default;
using D2.Contracts.Utilities.Constants;
using D2.Services.Protos.Geo.V1;
using Microsoft.Extensions.Configuration;
using Testcontainers.Redis;

/// <summary>
/// Integration tests for GeoRefDataService using Redis as the distributed cache and Default as the
/// memory cache.
/// </summary>
public class GeoRefDataServiceTests : IAsyncLifetime
{
    private RedisContainer _container = null!;
    private IServiceProvider _services = null!;
    private IHandlerContext _context = null!;

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        // Set up Redis container.
        _container = new RedisBuilder().Build();
        await _container.StartAsync();

        // Set up configuration.
        var configDict = new Dictionary<string, string>
        {
            ["LocalFilesPath"] = Path.GetTempPath(),
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(configDict!).Build();

        // Create handler context.
        _context = TestHelpers.CreateHandlerContext();

        // Set up services.
        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(config);
        services.AddTransient(_ => _context);
        services.AddLogging();
        services.AddRedisCaching(_container.GetConnectionString());
        services.AddDefaultMemoryCaching();
        services.AddGeoRefDataConsumer(config);

        // Build service provider.
        _services = services.BuildServiceProvider();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _container.DisposeAsync();

        // Clean up test file
        var filePath = Path.Combine(Path.GetTempPath(), Constants.GEO_REF_DATA_FILE_NAME);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }
    }

    /// <summary>
    /// Tests that getting georeference data when it exists only in Redis succeeds and
    /// populates both the in-memory cache and the on-disk cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async ValueTask Get_WithDataInRedis_SucceedsAndCachesInMemoryAndOnDisk()
    {
        // Arrange - put data only in Redis
        var setInDistHandler = _services.GetRequiredService<
        IDistributedCacheService.ISetHandler<GetReferenceDataResponse>>();
        await setInDistHandler.HandleAsync(
            new(Constants.DIST_CACHE_KEY_GEO_REF_DATA, TestHelpers.TestGeoRefData, null),
            Ct);

        var getHandler = _services.GetRequiredService<IGeoRefDataService.IGetHandler>();

        // Act - Get should cascade to memory and disk
        var result = await getHandler.HandleAsync(new(), Ct);

        // Assert - data retrieved successfully
        Assert.True(result.Success);
        Assert.NotNull(result.Data);

        // Assert - data now in memory cache
        var getFromMemHandler = _services.GetRequiredService<IGeoRefDataService.IGetFromMemHandler>();
        var memResult = await getFromMemHandler.HandleAsync(new(), Ct);
        Assert.True(memResult.Success);
        Assert.Equal(TestHelpers.TestGeoRefData.Version, memResult.Data!.Data.Version);

        // Assert - data now on disk
        var getFromDiskHandler = _services.GetRequiredService<IGeoRefDataService.IGetFromDiskHandler>();
        var diskResult = await getFromDiskHandler.HandleAsync(new(), Ct);
        Assert.True(diskResult.Success);
        Assert.Equal(TestHelpers.TestGeoRefData.Version, diskResult.Data!.Data.Version);
    }

    /// <summary>
    /// Tests that getting georeference data when it exists only in memory cache succeeds
    /// immediately without checking other sources.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async ValueTask Get_WithDataInMemory_SucceedsImmediately()
    {
        // Arrange - data only in memory
        var setInMemHandler = _services.GetRequiredService<IGeoRefDataService.ISetInMemHandler>();
        await setInMemHandler.HandleAsync(
            new(TestHelpers.TestGeoRefData),
            Ct);

        // Act
        var result = await _services.GetRequiredService<IGeoRefDataService.IGetHandler>()
            .HandleAsync(new(), Ct);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(TestHelpers.TestGeoRefData.Version, result.Data!.Data.Version);
    }

    /// <summary>
    /// Tests that getting georeference data when it exists only on disk succeeds and populates the
    /// in-memory cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async ValueTask Get_WithDataOnDiskOnly_SucceedsAndCachesInMemoryAndRedis()
    {
        // Arrange - data only on disk
        var setOnDiskHandler = _services.GetRequiredService<IGeoRefDataService.ISetOnDiskHandler>();
        await setOnDiskHandler.HandleAsync(
            new(TestHelpers.TestGeoRefData),
            Ct);

        // Act
        var result = await _services.GetRequiredService<IGeoRefDataService.IGetHandler>()
            .HandleAsync(new(), Ct);

        // Assert - retrieved successfully
        Assert.True(result.Success);

        // Assert - now cached in memory
        var memResult = await _services.GetRequiredService<IGeoRefDataService.IGetFromMemHandler>()
            .HandleAsync(new(), Ct);
        Assert.True(memResult.Success);
    }

    /// <summary>
    /// Tests that after the first call populates caches, subsequent calls use the in-memory
    /// cache even when Redis is unavailable.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async ValueTask Get_CalledTwice_SecondCallHitsMemoryCache()
    {
        // Arrange
        var setInDistHandler = _services.GetRequiredService<
            IDistributedCacheService.ISetHandler<GetReferenceDataResponse>>();
        await setInDistHandler.HandleAsync(
            new(Constants.DIST_CACHE_KEY_GEO_REF_DATA, TestHelpers.TestGeoRefData, null),
            Ct);

        var getHandler = _services.GetRequiredService<IGeoRefDataService.IGetHandler>();

        // Act - first call populates caches
        await getHandler.HandleAsync(new(), Ct);

        // Clear Redis to verify second call uses memory
        var redis = _services.GetRequiredService<StackExchange.Redis.IConnectionMultiplexer>();
        await redis.GetDatabase().KeyDeleteAsync(Constants.DIST_CACHE_KEY_GEO_REF_DATA);

        // Act - second call
        var result = await getHandler.HandleAsync(new(), Ct);

        // Assert - still succeeds from memory despite Redis cleared
        Assert.True(result.Success);
    }
}
