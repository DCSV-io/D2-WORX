// -----------------------------------------------------------------------
// <copyright file="CreateLocationsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Contracts.Handler;
using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Tests.Fixtures;
using D2.Services.Protos.Geo.V1;
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
        await _db.DisposeAsync().ConfigureAwait(false);
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
        var request = new CreateLocationsRequest();
        var input = new ICommands.CreateLocationsInput(request);

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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO
                {
                    City = uniqueCity,
                    PostalCode = "94102",
                    SubdivisionIso31662Code = "US-CA",
                    CountryIso31661Alpha2Code = "US",
                },
            },
        };
        var input = new ICommands.CreateLocationsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data[0].City.Should().Be(uniqueCity);
        result.Data.Data[0].PostalCode.Should().Be("94102");
        result.Data.Data[0].SubdivisionIso31662Code.Should().Be("US-CA");
        result.Data.Data[0].CountryIso31661Alpha2Code.Should().Be("US");
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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO { City = $"New York {suffix}", CountryIso31661Alpha2Code = "US" },
                new LocationToCreateDTO { City = $"Los Angeles {suffix}", CountryIso31661Alpha2Code = "US" },
                new LocationToCreateDTO { City = $"Chicago {suffix}", CountryIso31661Alpha2Code = "US" },
            },
        };
        var input = new ICommands.CreateLocationsInput(request);

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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO
                {
                    Coordinates = new CoordinatesDTO { Latitude = uniqueLat, Longitude = uniqueLon },
                    City = $"San Francisco {Guid.NewGuid():N}",
                    CountryIso31661Alpha2Code = "US",
                },
            },
        };
        var input = new ICommands.CreateLocationsInput(request);

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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO
                {
                    Address = new StreetAddressDTO
                    {
                        Line1 = uniqueAddress,
                        Line2 = "Suite 100",
                    },
                    City = $"Portland {Guid.NewGuid():N}",
                    PostalCode = "97201",
                    CountryIso31661Alpha2Code = "US",
                },
            },
        };
        var input = new ICommands.CreateLocationsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data[0].Address.Should().NotBeNull();
        result.Data.Data[0].Address!.Line1.Should().Be(uniqueAddress);
        result.Data.Data[0].Address.Line2.Should().Be("Suite 100");
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
        var sameLocation = new LocationToCreateDTO
        {
            City = uniqueCity,
            CountryIso31661Alpha2Code = "US",
        };

        var request = new CreateLocationsRequest
        {
            LocationsToCreate = { sameLocation, sameLocation, sameLocation },
        };
        var input = new ICommands.CreateLocationsInput(request);

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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO { City = uniqueCity, CountryIso31661Alpha2Code = "US" },
            },
        };
        var input = new ICommands.CreateLocationsInput(request);

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
