// -----------------------------------------------------------------------
// <copyright file="LocationHandlerTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.Infra.Repository.Handlers;

using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Geo.App.Interfaces.Repository.Handlers.C;
using D2.Geo.App.Interfaces.Repository.Handlers.R;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Infra.Repository.Handlers.C;
using D2.Geo.Infra.Repository.Handlers.R;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;

/// <summary>
/// Integration tests for Location repository handlers (GetLocationsByIds, CreateLocations).
/// </summary>
[MustDisposeResource(false)]
public class LocationHandlerTests : IAsyncLifetime
{
    private PostgreSqlContainer _container = null!;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:18")
            .Build();

        await _container.StartAsync(Ct);

        var dbOptions = new DbContextOptionsBuilder<GeoDbContext>()
            .UseNpgsql(_container.GetConnectionString())
            .Options;

        _db = new GeoDbContext(dbOptions);

        // Apply migrations (includes seed data).
        await _db.Database.MigrateAsync(Ct);

        _context = CreateHandlerContext();
        _options = Options.Create(new GeoInfraOptions { RepoQueryBatchSize = 100 });
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _container.DisposeAsync().ConfigureAwait(false);
    }

    #region CreateLocations Tests

    /// <summary>
    /// Tests that CreateLocations with empty input returns success with 0 inserted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithEmptyInput_ReturnsSuccessWithZeroInserted()
    {
        // Arrange
        var handler = new CreateLocations(_db, _options, _context);
        var input = new ICreate.CreateLocationsInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Created.Should().Be(0);
    }

    /// <summary>
    /// Tests that CreateLocations inserts new locations.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithNewLocations_InsertsAllLocations()
    {
        // Arrange
        var handler = new CreateLocations(_db, _options, _context);
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
        var input = new ICreate.CreateLocationsInput(locations);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Created.Should().Be(3);

        // Verify in database
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(3);
    }

    /// <summary>
    /// Tests that CreateLocations with duplicate locations only inserts unique ones.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithDuplicateLocations_OnlyInsertsUnique()
    {
        // Arrange
        var handler = new CreateLocations(_db, _options, _context);

        // Create same location twice (content-addressable = same hash)
        var location1 = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            city: "Los Angeles",
            countryISO31661Alpha2Code: "US");
        var location2 = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            city: "Los Angeles",
            countryISO31661Alpha2Code: "US");

        location1.HashId.Should().Be(location2.HashId); // Same content = same hash

        var input = new ICreate.CreateLocationsInput([location1, location2]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1); // Only one inserted since they're the same

        // Verify in database
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(1);
    }

    /// <summary>
    /// Tests that CreateLocations skips already existing locations.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithExistingLocations_SkipsExisting()
    {
        // Arrange
        var createHandler = new CreateLocations(_db, _options, _context);

        var existingLocation = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            city: "Los Angeles",
            countryISO31661Alpha2Code: "US");

        // Insert first
        var firstInput = new ICreate.CreateLocationsInput([existingLocation]);
        await createHandler.HandleAsync(firstInput, Ct);

        // Now try to insert same + new
        var newLocation = Location.Create(
            coordinates: Coordinates.Create(40.7128, -74.0060),
            city: "New York",
            countryISO31661Alpha2Code: "US");

        var secondInput = new ICreate.CreateLocationsInput([existingLocation, newLocation]);

        // Act
        var result = await createHandler.HandleAsync(secondInput, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1); // Only new one inserted

        // Verify in database
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(2);
    }

    #endregion

    #region GetLocationsByIds Tests

    /// <summary>
    /// Tests that GetLocationsByIds with empty input returns success with empty dictionary.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithEmptyInput_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = new GetLocationsByIds(_db, _options, _context);
        var input = new IRead.GetLocationsByIdInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert - Empty input returns Ok with empty data (not an error).
        result.Success.Should().BeTrue();
        result.ErrorCode.Should().BeNull();
        result.Data.Should().NotBeNull();
        result.Data!.Locations.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that GetLocationsByIds returns all requested locations.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithExistingIds_ReturnsAllLocations()
    {
        // Arrange - Create locations first
        var createHandler = new CreateLocations(_db, _options, _context);
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
        };
        await createHandler.HandleAsync(new ICreate.CreateLocationsInput(locations), Ct);

        var getHandler = new GetLocationsByIds(_db, _options, _context);
        var hashIds = locations.Select(l => l.HashId).ToList();
        var input = new IRead.GetLocationsByIdInput(hashIds);

        // Act
        var result = await getHandler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.ErrorCode.Should().BeNull();
        result.Data.Should().NotBeNull();
        result.Data!.Locations.Should().HaveCount(2);
        result.Data.Locations.Keys.Should().BeEquivalentTo(hashIds);
    }

    /// <summary>
    /// Tests that GetLocationsByIds returns partial results when some IDs don't exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithSomeMissingIds_ReturnsSomeFound()
    {
        // Arrange - Create one location
        var createHandler = new CreateLocations(_db, _options, _context);
        var existingLocation = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            city: "Los Angeles",
            countryISO31661Alpha2Code: "US");
        await createHandler.HandleAsync(new ICreate.CreateLocationsInput([existingLocation]), Ct);

        var getHandler = new GetLocationsByIds(_db, _options, _context);
        var nonExistentHashId = "0000000000000000000000000000000000000000000000000000000000000000";
        var input = new IRead.GetLocationsByIdInput([existingLocation.HashId, nonExistentHashId]);

        // Act
        var result = await getHandler.HandleAsync(input, Ct);

        // Assert - SOME_FOUND is a partial success (Success=false but data included).
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data.Should().NotBeNull();
        result.Data!.Locations.Should().HaveCount(1);
        result.Data.Locations.Should().ContainKey(existingLocation.HashId);
    }

    /// <summary>
    /// Tests that GetLocationsByIds returns NOT_FOUND when no IDs exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithNoExistingIds_ReturnsNotFound()
    {
        // Arrange
        var handler = new GetLocationsByIds(_db, _options, _context);
        var nonExistentHashIds = new List<string>
        {
            "0000000000000000000000000000000000000000000000000000000000000001",
            "0000000000000000000000000000000000000000000000000000000000000002",
        };
        var input = new IRead.GetLocationsByIdInput(nonExistentHashIds);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert - NOT_FOUND is a failure (Success=false).
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.NOT_FOUND);
        result.Data.Should().BeNull();
    }

    /// <summary>
    /// Tests that GetLocationsByIds handles large batches correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithLargeBatch_HandlesBatchingCorrectly()
    {
        // Arrange - Create 150 locations (more than batch size of 100)
        var createHandler = new CreateLocations(_db, _options, _context);
        var locations = Enumerable.Range(0, 150)
            .Select(i => Location.Create(
                coordinates: Coordinates.Create(i * 0.01, i * 0.01),
                city: $"City{i}",
                countryISO31661Alpha2Code: "US"))
            .ToList();
        await createHandler.HandleAsync(new ICreate.CreateLocationsInput(locations), Ct);

        var getHandler = new GetLocationsByIds(_db, _options, _context);
        var hashIds = locations.Select(l => l.HashId).ToList();
        var input = new IRead.GetLocationsByIdInput(hashIds);

        // Act
        var result = await getHandler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.ErrorCode.Should().BeNull();
        result.Data.Should().NotBeNull();
        result.Data!.Locations.Should().HaveCount(150);
    }

    /// <summary>
    /// Tests that GetLocationsByIds deduplicates duplicate IDs in input.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetLocationsByIds_WithDuplicateIds_DeduplicatesInput()
    {
        // Arrange - Create one location
        var createHandler = new CreateLocations(_db, _options, _context);
        var location = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            city: "Los Angeles",
            countryISO31661Alpha2Code: "US");
        await createHandler.HandleAsync(new ICreate.CreateLocationsInput([location]), Ct);

        var getHandler = new GetLocationsByIds(_db, _options, _context);

        // Request same ID multiple times
        var input = new IRead.GetLocationsByIdInput([
            location.HashId,
            location.HashId,
            location.HashId,
        ]);

        // Act
        var result = await getHandler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Locations.Should().HaveCount(1);
    }

    #endregion

    private static IHandlerContext CreateHandlerContext()
    {
        var requestContext = new Mock<IRequestContext>();
        requestContext.Setup(x => x.TraceId).Returns("test-trace-id");

        var logger = new Mock<ILogger>();

        var context = new Mock<IHandlerContext>();
        context.Setup(x => x.Request).Returns(requestContext.Object);
        context.Setup(x => x.Logger).Returns(logger.Object);

        return context.Object;
    }
}
