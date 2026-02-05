// -----------------------------------------------------------------------
// <copyright file="GeoRefDataProviderTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.Client;

using D2.Geo.Client.CQRS.Handlers.C;
using D2.Geo.Client.Interfaces.CQRS.Handlers.C;
using D2.Services.Protos.Geo.V1;

// ReSharper disable AccessToStaticMemberViaDerivedType
using D2.Shared.DistributedCache.Redis;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.R;
using D2.Shared.Utilities.Constants;
using JetBrains.Annotations;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.Redis;
using Xunit;

/// <summary>
/// Integration tests for GeoRefData provider-side handlers using Redis.
/// </summary>
[MustDisposeResource(false)]
public class GeoRefDataProviderTests : IAsyncLifetime
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
        await _container.StartAsync(Ct);

        // Create handler context.
        _context = ClientTestHelpers.CreateHandlerContext();

        // Set up services - provider-side registration.
        var services = new ServiceCollection();
        services.AddTransient(_ => _context);
        services.AddLogging();
        services.AddRedisCaching(_container.GetConnectionString());

        // Register provider-specific handler.
        services.AddTransient<ICommands.ISetInDistHandler, SetInDist>();

        // Build service provider.
        _services = services.BuildServiceProvider();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _container.DisposeAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Tests that SetInDist stores data in Redis successfully.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async ValueTask SetInDist_WithValidData_StoresInRedis()
    {
        // Arrange
        var handler = _services.GetRequiredService<ICommands.ISetInDistHandler>();

        // Act
        var result = await handler.HandleAsync(new(ClientTestHelpers.TestGeoRefData), Ct);

        // Assert - handler succeeded
        Assert.True(result.Success);

        // Assert - data retrievable from Redis via low-level handler
        var getHandler = _services.GetRequiredService<IRead.IGetHandler<GeoRefData>>();
        var getResult = await getHandler.HandleAsync(
            new(Constants.DIST_CACHE_KEY_GEO_REF_DATA),
            Ct);
        Assert.True(getResult.Success);
        Assert.Equal(ClientTestHelpers.TestGeoRefData.Version, getResult.Data!.Value!.Version);
    }

    /// <summary>
    /// Tests that SetInDist overwrites existing data in Redis.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async ValueTask SetInDist_WithExistingData_OverwritesInRedis()
    {
        // Arrange - store initial version
        var handler = _services.GetRequiredService<ICommands.ISetInDistHandler>();
        await handler.HandleAsync(new(ClientTestHelpers.TestGeoRefData), Ct);

        // Arrange - create new version
        var newVersionData = new GeoRefData
        {
            Version = "2.0.0",
            Countries = { { "CA", new CountryDTO { DisplayName = "Canada" } } },
        };

        // Act - overwrite with new version
        var result = await handler.HandleAsync(new(newVersionData), Ct);

        // Assert - handler succeeded
        Assert.True(result.Success);

        // Assert - new version retrievable
        var getHandler = _services.GetRequiredService<IRead.IGetHandler<GeoRefData>>();
        var getResult = await getHandler.HandleAsync(
            new(Constants.DIST_CACHE_KEY_GEO_REF_DATA),
            Ct);
        Assert.True(getResult.Success);
        Assert.Equal("2.0.0", getResult.Data!.Value!.Version);
    }
}
