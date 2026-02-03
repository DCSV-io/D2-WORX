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
using D2.Services.Protos.Geo.V1;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;
using CreateLocationsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateLocations;

/// <summary>
/// Integration tests for the <see cref="CreateLocations"/> CQRS handler.
/// </summary>
[MustDisposeResource(false)]
public class CreateLocationsTests : IAsyncLifetime
{
    private PostgreSqlContainer _pgContainer = null!;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

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
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
            .Options;
        _db = new GeoDbContext(dbOptions);
        await _db.Database.MigrateAsync(Ct);

        _context = CreateHandlerContext();
        _options = Options.Create(new GeoInfraOptions { RepoQueryBatchSize = 100 });
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _pgContainer.DisposeAsync().ConfigureAwait(false);
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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO
                {
                    City = "San Francisco",
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
        result.Data.Data[0].City.Should().Be("San Francisco");
        result.Data.Data[0].PostalCode.Should().Be("94102");
        result.Data.Data[0].SubdivisionIso31662Code.Should().Be("US-CA");
        result.Data.Data[0].CountryIso31661Alpha2Code.Should().Be("US");
        result.Data.Data[0].HashId.Should().HaveLength(64);

        // Verify in database
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(1);
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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO { City = "New York", CountryIso31661Alpha2Code = "US" },
                new LocationToCreateDTO { City = "Los Angeles", CountryIso31661Alpha2Code = "US" },
                new LocationToCreateDTO { City = "Chicago", CountryIso31661Alpha2Code = "US" },
            },
        };
        var input = new ICommands.CreateLocationsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(3);

        // Verify in database
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(3);
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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO
                {
                    Coordinates = new CoordinatesDTO { Latitude = 37.7749, Longitude = -122.4194 },
                    City = "San Francisco",
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
        result.Data.Data[0].Coordinates!.Latitude.Should().Be(37.7749);
        result.Data.Data[0].Coordinates.Longitude.Should().Be(-122.4194);
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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO
                {
                    Address = new StreetAddressDTO
                    {
                        Line1 = "123 Main St",
                        Line2 = "Suite 100",
                    },
                    City = "Portland",
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
        result.Data.Data[0].Address!.Line1.Should().Be("123 Main St");
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
        var sameLocation = new LocationToCreateDTO
        {
            City = "Denver",
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

        // Only one should be in database
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(1);
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
        var request = new CreateLocationsRequest
        {
            LocationsToCreate =
            {
                new LocationToCreateDTO { City = "Austin", CountryIso31661Alpha2Code = "US" },
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

        // Only one location in database
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(1);
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
