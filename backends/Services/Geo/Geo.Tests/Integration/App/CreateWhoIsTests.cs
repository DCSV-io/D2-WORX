// -----------------------------------------------------------------------
// <copyright file="CreateWhoIsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Contracts.Handler;
using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Geo.Domain.Entities;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Tests.Fixtures;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using CreateWhoIsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateWhoIs;

/// <summary>
/// Integration tests for the <see cref="CreateWhoIs"/> CQRS handler.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(value: false)]
public class CreateWhoIsTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateWhoIsTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public CreateWhoIsTests(SharedPostgresFixture fixture)
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
    /// Tests that CreateWhoIs with empty input returns success with zero created.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithEmptyInput_ReturnsZeroCreated()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new ICommands.CreateWhoIsInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(0);
    }

    #endregion

    #region Create Single WhoIs Tests

    /// <summary>
    /// Tests that CreateWhoIs creates a single WhoIs record.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithSingleRecord_CreatesRecord()
    {
        // Arrange
        var handler = CreateHandler();
        var uniqueIp = $"192.168.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}";
        var uniqueFp = Guid.NewGuid().ToString("N");
        var whoIs = WhoIs.Create(
            ipAddress: uniqueIp,
            year: 2025,
            month: 6,
            fingerprint: uniqueFp,
            asn: 12345,
            asName: "Test ISP",
            asDomain: "test-host.example.com");

        var input = new ICommands.CreateWhoIsInput([whoIs]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1);

        // Verify in database
        var dbRecord = await _db.WhoIsRecords.FirstOrDefaultAsync(w => w.HashId == whoIs.HashId, Ct);
        dbRecord.Should().NotBeNull();
        dbRecord.IPAddress.Should().Be(uniqueIp);
        dbRecord.ASName.Should().Be("Test ISP");
    }

    #endregion

    #region Create Multiple WhoIs Tests

    /// <summary>
    /// Tests that CreateWhoIs creates multiple WhoIs records.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithMultipleRecords_CreatesAll()
    {
        // Arrange
        var handler = CreateHandler();
        var baseIp = Random.Shared.Next(1, 255);
        var records = new List<WhoIs>
        {
            WhoIs.Create($"10.{baseIp}.0.1", 2025, 6, Guid.NewGuid().ToString("N"), 111, "AS111"),
            WhoIs.Create($"10.{baseIp}.0.2", 2025, 6, Guid.NewGuid().ToString("N"), 222, "AS222"),
            WhoIs.Create($"10.{baseIp}.0.3", 2025, 6, Guid.NewGuid().ToString("N"), 333, "AS333"),
        };

        var input = new ICommands.CreateWhoIsInput(records);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(3);
    }

    #endregion

    #region Deduplication Tests

    /// <summary>
    /// Tests that CreateWhoIs deduplicates records with the same hash ID.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithDuplicateHashIds_DeduplicatesRecords()
    {
        // Arrange
        var handler = CreateHandler();
        var uniqueIp = $"192.168.{Random.Shared.Next(1, 255)}.100";
        var uniqueFp = Guid.NewGuid().ToString("N");

        // Same IP, year, month, fingerprint = same hash
        var record1 = WhoIs.Create(uniqueIp, 2025, 7, uniqueFp, 100, "ASName");
        var record2 = WhoIs.Create(uniqueIp, 2025, 7, uniqueFp, 100, "ASName");
        var record3 = WhoIs.Create(uniqueIp, 2025, 7, uniqueFp, 100, "ASName");

        var input = new ICommands.CreateWhoIsInput([record1, record2, record3]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1); // Only one unique record
    }

    /// <summary>
    /// Tests that CreateWhoIs skips existing records.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithExistingRecord_SkipsExisting()
    {
        // Arrange - Create a record first
        var uniqueIp = $"8.8.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}";
        var uniqueFp = Guid.NewGuid().ToString("N");
        var existingRecord = WhoIs.Create(uniqueIp, 2025, 1, uniqueFp, 15169, "GOOGLE");
        _db.WhoIsRecords.Add(existingRecord);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();

        // Try to create the same record again plus a new one
        var sameRecord = WhoIs.Create(uniqueIp, 2025, 1, uniqueFp, 15169, "GOOGLE");
        var newIp = $"1.1.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}";
        var newRecord = WhoIs.Create(newIp, 2025, 1, Guid.NewGuid().ToString("N"), 13335, "CLOUDFLARENET");

        var input = new ICommands.CreateWhoIsInput([sameRecord, newRecord]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1); // Only the new record
    }

    /// <summary>
    /// Tests that calling CreateWhoIs twice with the same data doesn't create duplicates.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_CalledTwiceWithSameData_DoesNotDuplicate()
    {
        // Arrange
        var handler = CreateHandler();
        var uniqueIp = $"172.16.{Random.Shared.Next(1, 255)}.1";
        var uniqueFp = Guid.NewGuid().ToString("N");
        var record = WhoIs.Create(uniqueIp, 2025, 3, uniqueFp);

        var input = new ICommands.CreateWhoIsInput([record]);

        // Act - Call twice
        var result1 = await handler.HandleAsync(input, Ct);
        var result2 = await handler.HandleAsync(input, Ct);

        // Assert
        result1.Success.Should().BeTrue();
        result1.Data!.Created.Should().Be(1);

        result2.Success.Should().BeTrue();
        result2.Data!.Created.Should().Be(0); // No new records on second call
    }

    #endregion

    #region Location Reference Tests

    /// <summary>
    /// Tests that CreateWhoIs creates record with location reference.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithLocationHashId_StoresLocationReference()
    {
        // Arrange - Create a location first
        var uniqueCity = $"San Francisco {Guid.NewGuid():N}";
        var location = Location.Create(
            coordinates: null,
            address: null,
            city: uniqueCity,
            postalCode: "94102",
            subdivisionISO31662Code: "US-CA",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(location);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var uniqueIp = $"203.0.{Random.Shared.Next(1, 255)}.1";
        var whoIs = WhoIs.Create(
            ipAddress: uniqueIp,
            year: 2025,
            month: 8,
            fingerprint: Guid.NewGuid().ToString("N"),
            asn: 64512,
            asName: "Example Org",
            locationHashId: location.HashId);

        var input = new ICommands.CreateWhoIsInput([whoIs]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1);

        // Verify location reference in database
        var dbRecord = await _db.WhoIsRecords.FirstAsync(w => w.HashId == whoIs.HashId, Ct);
        dbRecord.LocationHashId.Should().Be(location.HashId);
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

    private ICommands.ICreateWhoIsHandler CreateHandler()
    {
        var createWhoIsRepo = new CreateWhoIsRepo(_db, _options, _context);
        return new CreateWhoIs(createWhoIsRepo, _context);
    }
}
