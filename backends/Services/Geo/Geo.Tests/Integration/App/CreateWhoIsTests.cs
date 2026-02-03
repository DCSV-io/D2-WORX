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
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;
using CreateWhoIsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateWhoIs;

/// <summary>
/// Integration tests for the <see cref="CreateWhoIs"/> CQRS handler.
/// </summary>
[MustDisposeResource(false)]
public class CreateWhoIsTests : IAsyncLifetime
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
        var whoIs = WhoIs.Create(
            ipAddress: "192.168.1.1",
            year: 2025,
            month: 6,
            fingerprint: "test-fingerprint",
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
        var dbRecords = await _db.WhoIsRecords.ToListAsync(Ct);
        dbRecords.Should().HaveCount(1);
        dbRecords[0].IPAddress.Should().Be("192.168.1.1");
        dbRecords[0].ASName.Should().Be("Test ISP");
        dbRecords[0].ASDomain.Should().Be("test-host.example.com");
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
        var records = new List<WhoIs>
        {
            WhoIs.Create("10.0.0.1", 2025, 6, "fp1", 111, "AS111"),
            WhoIs.Create("10.0.0.2", 2025, 6, "fp2", 222, "AS222"),
            WhoIs.Create("10.0.0.3", 2025, 6, "fp3", 333, "AS333"),
        };

        var input = new ICommands.CreateWhoIsInput(records);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(3);

        // Verify in database
        var dbRecords = await _db.WhoIsRecords.ToListAsync(Ct);
        dbRecords.Should().HaveCount(3);
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

        // Same IP, year, month, fingerprint = same hash
        var record1 = WhoIs.Create("192.168.1.100", 2025, 7, "same-fp", 100, "ASName");
        var record2 = WhoIs.Create("192.168.1.100", 2025, 7, "same-fp", 100, "ASName");
        var record3 = WhoIs.Create("192.168.1.100", 2025, 7, "same-fp", 100, "ASName");

        var input = new ICommands.CreateWhoIsInput([record1, record2, record3]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1); // Only one unique record

        // Verify in database
        var dbRecords = await _db.WhoIsRecords.ToListAsync(Ct);
        dbRecords.Should().HaveCount(1);
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
        var existingRecord = WhoIs.Create("8.8.8.8", 2025, 1, "existing-fp", 15169, "GOOGLE");
        _db.WhoIsRecords.Add(existingRecord);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();

        // Try to create the same record again plus a new one
        var sameRecord = WhoIs.Create("8.8.8.8", 2025, 1, "existing-fp", 15169, "GOOGLE");
        var newRecord = WhoIs.Create("1.1.1.1", 2025, 1, "new-fp", 13335, "CLOUDFLARENET");

        var input = new ICommands.CreateWhoIsInput([sameRecord, newRecord]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1); // Only the new record

        // Verify in database - should have 2 records total
        var dbRecords = await _db.WhoIsRecords.ToListAsync(Ct);
        dbRecords.Should().HaveCount(2);
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
        var record = WhoIs.Create("172.16.0.1", 2025, 3, "idempotent-fp");

        var input = new ICommands.CreateWhoIsInput([record]);

        // Act - Call twice
        var result1 = await handler.HandleAsync(input, Ct);
        var result2 = await handler.HandleAsync(input, Ct);

        // Assert
        result1.Success.Should().BeTrue();
        result1.Data!.Created.Should().Be(1);

        result2.Success.Should().BeTrue();
        result2.Data!.Created.Should().Be(0); // No new records on second call

        // Verify in database - only one record
        var dbRecords = await _db.WhoIsRecords.ToListAsync(Ct);
        dbRecords.Should().HaveCount(1);
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
        var location = Location.Create(
            coordinates: null,
            address: null,
            city: "San Francisco",
            postalCode: "94102",
            subdivisionISO31662Code: "US-CA",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(location);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var whoIs = WhoIs.Create(
            ipAddress: "203.0.113.1",
            year: 2025,
            month: 8,
            fingerprint: "geo-fp",
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
        var dbRecord = await _db.WhoIsRecords.FirstAsync(Ct);
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
