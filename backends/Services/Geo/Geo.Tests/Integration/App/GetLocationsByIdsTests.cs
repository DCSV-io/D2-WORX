// -----------------------------------------------------------------------
// <copyright file="GetLocationsByIdsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Contracts.Handler;
using D2.Contracts.InMemoryCache.Default;
using D2.Contracts.InMemoryCache.Default.Handlers.R;
using D2.Contracts.InMemoryCache.Default.Handlers.U;
using D2.Contracts.Result;
using D2.Geo.App;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.App.Interfaces.Repository.Handlers.C;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Infra.Repository.Handlers.C;
using D2.Services.Protos.Geo.V1;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;
using CacheRead = D2.Contracts.Interfaces.Caching.InMemory.Handlers.R.IRead;
using CacheUpdate = D2.Contracts.Interfaces.Caching.InMemory.Handlers.U.IUpdate;
using GetLocationsByIdsCqrs = D2.Geo.App.Implementations.CQRS.Handlers.Q.GetLocationsByIds;
using GetLocationsByIdsRepo = D2.Geo.Infra.Repository.Handlers.R.GetLocationsByIds;
using RepoRead = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead;

/// <summary>
/// Integration tests for the <see cref="GetLocationsByIdsCqrs"/> CQRS handler.
/// </summary>
[MustDisposeResource(false)]
public class GetLocationsByIdsTests : IAsyncLifetime
{
    private PostgreSqlContainer _pgContainer = null!;
    private ServiceProvider _services = null!;
    private GeoDbContext _db = null!;

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _pgContainer = new PostgreSqlBuilder()
            .WithImage("postgres:18")
            .Build();
        await _pgContainer.StartAsync(Ct);

        var dbOptions = new DbContextOptionsBuilder<GeoDbContext>()
            .UseNpgsql(_pgContainer.GetConnectionString())
            .Options;
        _db = new GeoDbContext(dbOptions);
        await _db.Database.MigrateAsync(Ct);

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDefaultMemoryCaching();

        // Register options.
        services.AddSingleton(Options.Create(new GeoAppOptions
        {
            LocationExpirationDuration = TimeSpan.FromMinutes(5),
        }));
        services.AddSingleton(Options.Create(new GeoInfraOptions
        {
            RepoQueryBatchSize = 100,
        }));

        // Register database context.
        services.AddSingleton(_db);

        // Register handlers.
        services.AddTransient<IHandlerContext>(_ => CreateHandlerContext());
        services.AddTransient(typeof(CacheRead.IGetManyHandler<>), typeof(GetMany<>));
        services.AddTransient(typeof(CacheUpdate.ISetManyHandler<>), typeof(SetMany<>));
        services.AddTransient<RepoRead.IGetLocationsByIdsHandler, GetLocationsByIdsRepo>();
        services.AddTransient<ICreate.ICreateLocationsHandler, CreateLocations>();
        services.AddTransient<IQueries.IGetLocationsByIdsHandler, GetLocationsByIdsCqrs>();

        _services = services.BuildServiceProvider();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _services.DisposeAsync();
        await _db.DisposeAsync();
        await _pgContainer.DisposeAsync().ConfigureAwait(false);
    }

    #region Success Path Tests

    /// <summary>
    /// Tests that GetLocationsByIds returns empty dictionary when no IDs are provided.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithEmptyInput_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = _services.GetRequiredService<IQueries.IGetLocationsByIdsHandler>();
        var request = new GetLocationsRequest();
        var input = new IQueries.GetLocationsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that GetLocationsByIds returns all locations when they exist in the database.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithExistingLocations_ReturnsAllLocations()
    {
        // Arrange - Create locations
        var locations = await CreateTestLocationsAsync();
        var hashIds = locations.Select(l => l.HashId).ToList();

        var handler = _services.GetRequiredService<IQueries.IGetLocationsByIdsHandler>();
        var request = new GetLocationsRequest();
        request.HashIds.AddRange(hashIds);
        var input = new IQueries.GetLocationsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(3);
        result.Data.Data.Keys.Should().BeEquivalentTo(hashIds);
    }

    /// <summary>
    /// Tests that GetLocationsByIds caches results and returns from memory on second call.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_OnSecondCall_ReturnsFromMemoryCache()
    {
        // Arrange - Create locations and make first call
        var locations = await CreateTestLocationsAsync();
        var hashIds = locations.Select(l => l.HashId).ToList();

        var handler = _services.GetRequiredService<IQueries.IGetLocationsByIdsHandler>();
        var request = new GetLocationsRequest();
        request.HashIds.AddRange(hashIds);
        var input = new IQueries.GetLocationsByIdsInput(request);

        // First call - fetches from database
        var firstResult = await handler.HandleAsync(input, Ct);
        firstResult.Success.Should().BeTrue();

        // Delete from database to verify cache is used
        _db.Locations.RemoveRange(_db.Locations);
        await _db.SaveChangesAsync(Ct);

        // Act - Second call should return from cache
        var secondResult = await handler.HandleAsync(input, Ct);

        // Assert
        secondResult.Success.Should().BeTrue();
        secondResult.Data!.Data.Should().HaveCount(3);
    }

    /// <summary>
    /// Tests that GetLocationsByIds returns correct DTO mapping.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_ReturnsCorrectlyMappedDTOs()
    {
        // Arrange
        var location = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            address: StreetAddress.Create("123 Main St", "Suite 100"),
            city: "Los Angeles",
            postalCode: "90001",
            subdivisionISO31662Code: "US-CA",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(location);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetLocationsByIdsHandler>();
        var request = new GetLocationsRequest();
        request.HashIds.Add(location.HashId);
        var input = new IQueries.GetLocationsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        var dto = result.Data!.Data[location.HashId];
        dto.HashId.Should().Be(location.HashId);
        dto.City.Should().Be("Los Angeles");
        dto.PostalCode.Should().Be("90001");
        dto.SubdivisionIso31662Code.Should().Be("US-CA");
        dto.CountryIso31661Alpha2Code.Should().Be("US");
        dto.Coordinates.Should().NotBeNull();
        dto.Coordinates!.Latitude.Should().BeApproximately(34.0522, 0.0001);
        dto.Coordinates.Longitude.Should().BeApproximately(-118.2437, 0.0001);
        dto.Address.Should().NotBeNull();
        dto.Address!.Line1.Should().Be("123 Main St");
        dto.Address.Line2.Should().Be("Suite 100");
    }

    #endregion

    #region Partial Success / Failure Tests

    /// <summary>
    /// Tests that GetLocationsByIds returns SomeFound when some IDs don't exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithSomeMissingIds_ReturnsSomeFound()
    {
        // Arrange
        var existingLocation = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            city: "Los Angeles",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(existingLocation);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetLocationsByIdsHandler>();
        var nonExistentId = "0000000000000000000000000000000000000000000000000000000000000000";
        var request = new GetLocationsRequest();
        request.HashIds.Add(existingLocation.HashId);
        request.HashIds.Add(nonExistentId);
        var input = new IQueries.GetLocationsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data.Should().NotBeNull();
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data.Should().ContainKey(existingLocation.HashId);
    }

    /// <summary>
    /// Tests that GetLocationsByIds returns NotFound when no IDs exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithNoExistingIds_ReturnsNotFound()
    {
        // Arrange
        var handler = _services.GetRequiredService<IQueries.IGetLocationsByIdsHandler>();
        var request = new GetLocationsRequest();
        request.HashIds.Add("0000000000000000000000000000000000000000000000000000000000000001");
        request.HashIds.Add("0000000000000000000000000000000000000000000000000000000000000002");
        var input = new IQueries.GetLocationsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.NOT_FOUND);
        result.Data.Should().BeNull();
    }

    #endregion

    #region Cache Behavior Tests

    /// <summary>
    /// Tests that GetLocationsByIds fetches missing locations from DB when some are in cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithPartialCache_FetchesMissingFromDb()
    {
        // Arrange - Create two locations
        var location1 = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            city: "Los Angeles",
            countryISO31661Alpha2Code: "US");
        var location2 = Location.Create(
            coordinates: Coordinates.Create(40.7128, -74.0060),
            city: "New York",
            countryISO31661Alpha2Code: "US");
        _db.Locations.AddRange(location1, location2);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetLocationsByIdsHandler>();

        // First call - only fetch location1 to cache it
        var firstRequest = new GetLocationsRequest();
        firstRequest.HashIds.Add(location1.HashId);
        var firstResult = await handler.HandleAsync(new IQueries.GetLocationsByIdsInput(firstRequest), Ct);
        firstResult.Success.Should().BeTrue();

        // Act - Second call with both locations
        var secondRequest = new GetLocationsRequest();
        secondRequest.HashIds.Add(location1.HashId);
        secondRequest.HashIds.Add(location2.HashId);
        var secondResult = await handler.HandleAsync(new IQueries.GetLocationsByIdsInput(secondRequest), Ct);

        // Assert - Both returned (location1 from cache, location2 from DB)
        secondResult.Success.Should().BeTrue();
        secondResult.Data!.Data.Should().HaveCount(2);
        secondResult.Data.Data.Should().ContainKey(location1.HashId);
        secondResult.Data.Data.Should().ContainKey(location2.HashId);
    }

    /// <summary>
    /// Tests that GetLocationsByIds handles large batch with mixed cache/DB.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithLargeBatch_HandlesCorrectly()
    {
        // Arrange - Create 150 locations
        var locations = Enumerable.Range(0, 150)
            .Select(i => Location.Create(
                coordinates: Coordinates.Create(i * 0.01, i * 0.01),
                city: $"City{i}",
                countryISO31661Alpha2Code: "US"))
            .ToList();
        _db.Locations.AddRange(locations);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetLocationsByIdsHandler>();
        var request = new GetLocationsRequest();
        request.HashIds.AddRange(locations.Select(l => l.HashId));
        var input = new IQueries.GetLocationsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(150);
    }

    #endregion

    private static IHandlerContext CreateHandlerContext()
    {
        var requestContext = new Mock<IRequestContext>();
        requestContext.Setup(x => x.TraceId).Returns(Guid.NewGuid().ToString());

        var logger = new Mock<ILogger>();

        var context = new Mock<IHandlerContext>();
        context.Setup(x => x.Request).Returns(requestContext.Object);
        context.Setup(x => x.Logger).Returns(logger.Object);

        return context.Object;
    }

    private async Task<List<Location>> CreateTestLocationsAsync()
    {
        var locations = new List<Location>
        {
            Location.Create(
                coordinates: Coordinates.Create(34.0522, -118.2437),
                city: "Los Angeles",
                countryISO31661Alpha2Code: "US"),
            Location.Create(
                coordinates: Coordinates.Create(40.7128, -74.0060),
                city: "New York",
                countryISO31661Alpha2Code: "US"),
            Location.Create(
                coordinates: Coordinates.Create(51.5074, -0.1278),
                city: "London",
                countryISO31661Alpha2Code: "GB"),
        };
        _db.Locations.AddRange(locations);
        await _db.SaveChangesAsync(Ct);
        return locations;
    }
}
