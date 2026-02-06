// -----------------------------------------------------------------------
// <copyright file="CreateLocationsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Tests.Fixtures;
using D2.Shared.Handler;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using CreateLocationsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateLocations;

/// <summary>
/// Integration tests for the <see cref="CreateLocations"/> CQRS handler.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(value: false)]
public class CreateLocationsTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateLocationsTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public CreateLocationsTests(SharedPostgresFixture fixture)
    {
        r_fixture = fixture;
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public ValueTask InitializeAsync()
    {
        _db = r_fixture.CreateDbContext();
        _context = CreateHandlerContext();
        _options = Options.Create(new GeoInfraOptions { RepoQueryBatchSize = 100 });
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
    }

    #region Empty Input Tests

    /// <summary>
    /// Tests that CreateLocations with empty input returns success with empty list.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithEmptyInput_ReturnsEmptyList()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new ICommands.CreateLocationsInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
    }

    #endregion

    #region Create Location Tests

    /// <summary>
    /// Tests that CreateLocations creates a single location.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithSingleLocation_CreatesLocation()
    {
        // Arrange
        var handler = CreateHandler();
        var uniqueCity = $"San Francisco {Guid.NewGuid():N}";
        var location = Location.Create(
            city: uniqueCity,
            postalCode: "94102",
            subdivisionISO31662Code: "US-CA",
            countryISO31661Alpha2Code: "US");
        var input = new ICommands.CreateLocationsInput([location]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data[0].City.Should().Be(uniqueCity);
        result.Data.Data[0].PostalCode.Should().Be("94102");
        result.Data.Data[0].SubdivisionISO31662Code.Should().Be("US-CA");
        result.Data.Data[0].CountryISO31661Alpha2Code.Should().Be("US");
        result.Data.Data[0].HashId.Should().HaveLength(64);
    }

    /// <summary>
    /// Tests that CreateLocations creates multiple locations.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithMultipleLocations_CreatesAll()
    {
        // Arrange
        var handler = CreateHandler();
        var suffix = Guid.NewGuid().ToString("N");
        var locations = new List<Location>
        {
            Location.Create(city: $"New York {suffix}", countryISO31661Alpha2Code: "US"),
            Location.Create(city: $"Los Angeles {suffix}", countryISO31661Alpha2Code: "US"),
            Location.Create(city: $"Chicago {suffix}", countryISO31661Alpha2Code: "US"),
        };
        var input = new ICommands.CreateLocationsInput(locations);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(3);
    }

    /// <summary>
    /// Tests that CreateLocations with coordinates creates location correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithCoordinates_CreatesLocationWithCoordinates()
    {
        // Arrange
        var handler = CreateHandler();
        var uniqueLat = 37.0 + (Random.Shared.NextDouble() * 0.5);
        var uniqueLon = -122.0 - (Random.Shared.NextDouble() * 0.5);
        var location = Location.Create(
            coordinates: Coordinates.Create(uniqueLat, uniqueLon),
            city: $"San Francisco {Guid.NewGuid():N}",
            countryISO31661Alpha2Code: "US");
        var input = new ICommands.CreateLocationsInput([location]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data[0].Coordinates.Should().NotBeNull();
    }

    /// <summary>
    /// Tests that CreateLocations with address creates location correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithAddress_CreatesLocationWithAddress()
    {
        // Arrange
        var handler = CreateHandler();
        var uniqueAddress = $"123 Main St {Guid.NewGuid():N}";
        var location = Location.Create(
            address: StreetAddress.Create(uniqueAddress, "Suite 100"),
            city: $"Portland {Guid.NewGuid():N}",
            postalCode: "97201",
            countryISO31661Alpha2Code: "US");
        var input = new ICommands.CreateLocationsInput([location]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        var first = result.Data!.Data[0];
        first.Address!.Should().NotBeNull();
        first.Address.Line1.Should().Be(uniqueAddress);
        first.Address.Line2.Should().Be("Suite 100");
    }

    #endregion

    #region Deduplication Tests

    /// <summary>
    /// Tests that CreateLocations deduplicates same locations.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_WithDuplicateLocations_ReturnsSameHashIds()
    {
        // Arrange
        var handler = CreateHandler();
        var uniqueCity = $"Denver {Guid.NewGuid():N}";
        var location = Location.Create(city: uniqueCity, countryISO31661Alpha2Code: "US");

        var input = new ICommands.CreateLocationsInput([location, location, location]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(3);

        // All should have the same hash ID
        var hashIds = result.Data.Data.Select(l => l.HashId).Distinct().ToList();
        hashIds.Should().HaveCount(1);
    }

    /// <summary>
    /// Tests that CreateLocations on second call with same data doesn't create duplicates.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateLocations_CalledTwiceWithSameData_DoesNotDuplicate()
    {
        // Arrange
        var handler = CreateHandler();
        var uniqueCity = $"Austin {Guid.NewGuid():N}";
        var location = Location.Create(city: uniqueCity, countryISO31661Alpha2Code: "US");
        var input = new ICommands.CreateLocationsInput([location]);

        // Act - Call twice
        var result1 = await handler.HandleAsync(input, Ct);
        var result2 = await handler.HandleAsync(input, Ct);

        // Assert
        result1.Success.Should().BeTrue();
        result2.Success.Should().BeTrue();

        // Both should return the same hash ID
        result1.Data!.Data[0].HashId.Should().Be(result2.Data!.Data[0].HashId);
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

    private ICommands.ICreateLocationsHandler CreateHandler()
    {
        var createLocationsRepo = new CreateLocationsRepo(_db, _options, _context);
        return new CreateLocations(createLocationsRepo, _context);
    }
}
