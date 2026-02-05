// -----------------------------------------------------------------------
// <copyright file="GetWhoIsByIdsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Geo.App;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.App.Interfaces.Repository.Handlers.C;
using D2.Geo.Domain.Entities;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Infra.Repository.Handlers.C;
using D2.Geo.Tests.Fixtures;
using D2.Shared.Handler;
using D2.Shared.InMemoryCache.Default;
using D2.Shared.InMemoryCache.Default.Handlers.R;
using D2.Shared.InMemoryCache.Default.Handlers.U;
using D2.Shared.Result;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using CacheRead = D2.Shared.Interfaces.Caching.InMemory.Handlers.R.IRead;
using CacheUpdate = D2.Shared.Interfaces.Caching.InMemory.Handlers.U.IUpdate;
using GetLocationsByIdsCqrs = D2.Geo.App.Implementations.CQRS.Handlers.Q.GetLocationsByIds;
using GetLocationsByIdsRepo = D2.Geo.Infra.Repository.Handlers.R.GetLocationsByIds;
using GetWhoIsByIdsCqrs = D2.Geo.App.Implementations.CQRS.Handlers.Q.GetWhoIsByIds;
using GetWhoIsByIdsRepo = D2.Geo.Infra.Repository.Handlers.R.GetWhoIsByIds;
using RepoRead = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead;

/// <summary>
/// Integration tests for the <see cref="GetWhoIsByIdsCqrs"/> CQRS handler.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(value: false)]
public class GetWhoIsByIdsTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private ServiceProvider _services = null!;
    private GeoDbContext _db = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetWhoIsByIdsTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public GetWhoIsByIdsTests(SharedPostgresFixture fixture)
    {
        r_fixture = fixture;
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public ValueTask InitializeAsync()
    {
        _db = r_fixture.CreateDbContext();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDefaultMemoryCaching();

        // Register options.
        services.AddSingleton(Options.Create(new GeoAppOptions
        {
            WhoIsExpirationDuration = TimeSpan.FromMinutes(5),
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
        services.AddTransient<RepoRead.IGetWhoIsByIdsHandler, GetWhoIsByIdsRepo>();
        services.AddTransient<ICreate.ICreateWhoIsHandler, CreateWhoIs>();
        services.AddTransient<IQueries.IGetLocationsByIdsHandler, GetLocationsByIdsCqrs>();
        services.AddTransient<IQueries.IGetWhoIsByIdsHandler, GetWhoIsByIdsCqrs>();

        _services = services.BuildServiceProvider();
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _services.DisposeAsync().ConfigureAwait(false);
        await _db.DisposeAsync().ConfigureAwait(false);
    }

    #region Success Path Tests

    /// <summary>
    /// Tests that GetWhoIsByIds returns empty dictionary when no IDs are provided.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithEmptyInput_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();
        var input = new IQueries.GetWhoIsByIdsInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that GetWhoIsByIds returns all WhoIs records when they exist in the database.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithExistingRecords_ReturnsAllRecords()
    {
        // Arrange - Create WhoIs records
        var whoIsRecords = await CreateTestWhoIsRecordsAsync();
        var hashIds = whoIsRecords.Select(w => w.HashId).ToList();

        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();
        var input = new IQueries.GetWhoIsByIdsInput(hashIds);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(3);
        result.Data.Data.Keys.Should().BeEquivalentTo(hashIds);
    }

    /// <summary>
    /// Tests that GetWhoIsByIds caches results and returns from memory on second call.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_OnSecondCall_ReturnsFromMemoryCache()
    {
        // Arrange - Create WhoIs records and make first call
        var whoIsRecords = await CreateTestWhoIsRecordsAsync();
        var hashIds = whoIsRecords.Select(w => w.HashId).ToList();

        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();
        var input = new IQueries.GetWhoIsByIdsInput(hashIds);

        // First call - fetches from database
        var firstResult = await handler.HandleAsync(input, Ct);
        firstResult.Success.Should().BeTrue();

        // Delete from database to verify cache is used
        _db.WhoIsRecords.RemoveRange(_db.WhoIsRecords);
        await _db.SaveChangesAsync(Ct);

        // Act - Second call should return from cache
        var secondResult = await handler.HandleAsync(input, Ct);

        // Assert
        secondResult.Success.Should().BeTrue();
        secondResult.Data!.Data.Should().HaveCount(3);
    }

    /// <summary>
    /// Tests that GetWhoIsByIds returns correct DTO mapping.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_ReturnsCorrectlyMappedDTOs()
    {
        // Arrange
        var whoIs = WhoIs.Create(
            ipAddress: "192.168.1.1",
            year: 2025,
            month: 6,
            fingerprint: "Mozilla/5.0",
            asn: 12345,
            asName: "Test AS",
            asDomain: "test.com",
            asType: "ISP",
            isVpn: true,
            isMobile: false);
        _db.WhoIsRecords.Add(whoIs);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();
        var input = new IQueries.GetWhoIsByIdsInput([whoIs.HashId]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        var dto = result.Data!.Data[whoIs.HashId];
        dto.HashId.Should().Be(whoIs.HashId);
        dto.IpAddress.Should().Be("192.168.1.1");
        dto.Year.Should().Be(2025);
        dto.Month.Should().Be(6);
        dto.Fingerprint.Should().Be("Mozilla/5.0");
        dto.Asn.Should().Be(12345);
        dto.AsName.Should().Be("Test AS");
        dto.AsDomain.Should().Be("test.com");
        dto.AsType.Should().Be("ISP");
        dto.IsVpn.Should().BeTrue();
        dto.IsMobile.Should().BeFalse();

        // Location should be null when WhoIs has no LocationHashId
        dto.Location.Should().BeNull();
    }

    /// <summary>
    /// Tests that GetWhoIsByIds returns nested Location data when WhoIs has a location.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithLocation_ReturnsNestedLocationData()
    {
        // Arrange - Create a location first
        var suffix = Guid.NewGuid().ToString("N");
        var location = Location.Create(
            coordinates: null,
            address: null,
            city: $"Test City {suffix}",
            postalCode: "12345",
            subdivisionISO31662Code: "US-CA",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(location);
        await _db.SaveChangesAsync(Ct);

        // Create WhoIs with reference to the location
        var whoIs = WhoIs.Create(
            ipAddress: $"10.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}",
            year: 2025,
            month: 7,
            fingerprint: $"test-fp-{suffix}",
            asn: 99999,
            asName: "Location Test AS",
            locationHashId: location.HashId);
        _db.WhoIsRecords.Add(whoIs);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();
        var input = new IQueries.GetWhoIsByIdsInput([whoIs.HashId]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        var dto = result.Data!.Data[whoIs.HashId];

        // Verify WhoIs fields
        dto.HashId.Should().Be(whoIs.HashId);
        dto.Asn.Should().Be(99999);

        // Verify nested Location is present and correct
        dto.Location.Should().NotBeNull();
        dto.Location!.HashId.Should().Be(location.HashId);
        dto.Location.City.Should().Be($"Test City {suffix}");
        dto.Location.PostalCode.Should().Be("12345");
        dto.Location.SubdivisionIso31662Code.Should().Be("US-CA");
        dto.Location.CountryIso31661Alpha2Code.Should().Be("US");
    }

    /// <summary>
    /// Tests that GetWhoIsByIds handles mixed records - some with locations, some without.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithMixedLocationScenarios_HandlesGracefully()
    {
        // Arrange - Create a location
        var suffix = Guid.NewGuid().ToString("N");
        var location = Location.Create(
            coordinates: null,
            address: null,
            city: $"Mixed City {suffix}",
            postalCode: "54321",
            subdivisionISO31662Code: null,
            countryISO31661Alpha2Code: "CA");
        _db.Locations.Add(location);
        await _db.SaveChangesAsync(Ct);

        // Create WhoIs WITH location
        var whoIsWithLocation = WhoIs.Create(
            ipAddress: $"172.{Random.Shared.Next(16, 31)}.{Random.Shared.Next(1, 255)}.1",
            year: 2025,
            month: 8,
            fingerprint: $"with-loc-{suffix}",
            locationHashId: location.HashId);

        // Create WhoIs WITHOUT location
        var whoIsWithoutLocation = WhoIs.Create(
            ipAddress: $"172.{Random.Shared.Next(16, 31)}.{Random.Shared.Next(1, 255)}.2",
            year: 2025,
            month: 8,
            fingerprint: $"no-loc-{suffix}");

        _db.WhoIsRecords.AddRange(whoIsWithLocation, whoIsWithoutLocation);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();
        var input = new IQueries.GetWhoIsByIdsInput([whoIsWithLocation.HashId, whoIsWithoutLocation.HashId]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(2);

        // WhoIs with location should have nested Location data
        var dtoWithLocation = result.Data.Data[whoIsWithLocation.HashId];
        dtoWithLocation.Location.Should().NotBeNull();
        dtoWithLocation.Location!.City.Should().Be($"Mixed City {suffix}");

        // WhoIs without location should have null Location
        var dtoWithoutLocation = result.Data.Data[whoIsWithoutLocation.HashId];
        dtoWithoutLocation.Location.Should().BeNull();
    }

    #endregion

    #region Partial Success / Failure Tests

    /// <summary>
    /// Tests that GetWhoIsByIds returns SomeFound when some IDs don't exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithSomeMissingIds_ReturnsSomeFound()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var existingWhoIs = WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}", 2025, 1, $"fingerprint-{suffix}");
        _db.WhoIsRecords.Add(existingWhoIs);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();
        var nonExistentId = "0000000000000000000000000000000000000000000000000000000000000000";
        var input = new IQueries.GetWhoIsByIdsInput([existingWhoIs.HashId, nonExistentId]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data.Should().NotBeNull();
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data.Should().ContainKey(existingWhoIs.HashId);
    }

    /// <summary>
    /// Tests that GetWhoIsByIds returns NotFound when no IDs exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithNoExistingIds_ReturnsNotFound()
    {
        // Arrange
        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();
        var input = new IQueries.GetWhoIsByIdsInput([
            "0000000000000000000000000000000000000000000000000000000000000001",
            "0000000000000000000000000000000000000000000000000000000000000002",
        ]);

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
    /// Tests that GetWhoIsByIds fetches missing records from DB when some are in cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithPartialCache_FetchesMissingFromDb()
    {
        // Arrange - Create two WhoIs records with unique IPs/fingerprints
        var suffix = Guid.NewGuid().ToString("N");
        var whoIs1 = WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.1", 2025, 1, $"fingerprint-1-{suffix}");
        var whoIs2 = WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.2", 2025, 1, $"fingerprint-2-{suffix}");
        _db.WhoIsRecords.AddRange(whoIs1, whoIs2);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();

        // First call - only fetch whoIs1 to cache it
        var firstResult = await handler.HandleAsync(new IQueries.GetWhoIsByIdsInput([whoIs1.HashId]), Ct);
        firstResult.Success.Should().BeTrue();

        // Act - Second call with both records
        var secondResult = await handler.HandleAsync(new IQueries.GetWhoIsByIdsInput([whoIs1.HashId, whoIs2.HashId]), Ct);

        // Assert - Both returned (whoIs1 from cache, whoIs2 from DB)
        secondResult.Success.Should().BeTrue();
        secondResult.Data!.Data.Should().HaveCount(2);
        secondResult.Data.Data.Should().ContainKey(whoIs1.HashId);
        secondResult.Data.Data.Should().ContainKey(whoIs2.HashId);
    }

    /// <summary>
    /// Tests that GetWhoIsByIds handles large batch with mixed cache/DB.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithLargeBatch_HandlesCorrectly()
    {
        // Arrange - Create 150 WhoIs records with unique fingerprints
        var suffix = Guid.NewGuid().ToString("N");
        var whoIsRecords = Enumerable.Range(0, 150)
            .Select(i => WhoIs.Create($"10.0.{i / 256}.{i % 256}", 2025, 1, $"fingerprint-{i}-{suffix}"))
            .ToList();
        _db.WhoIsRecords.AddRange(whoIsRecords);
        await _db.SaveChangesAsync(Ct);

        var handler = _services.GetRequiredService<IQueries.IGetWhoIsByIdsHandler>();
        var input = new IQueries.GetWhoIsByIdsInput(whoIsRecords.Select(w => w.HashId).ToList());

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

    private async Task<List<WhoIs>> CreateTestWhoIsRecordsAsync()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var whoIsRecords = new List<WhoIs>
        {
            WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.1", 2025, 1, $"fingerprint-1-{suffix}"),
            WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.2", 2025, 1, $"fingerprint-2-{suffix}"),
            WhoIs.Create($"10.0.{Random.Shared.Next(1, 255)}.1", 2025, 2, $"fingerprint-3-{suffix}"),
        };
        _db.WhoIsRecords.AddRange(whoIsRecords);
        await _db.SaveChangesAsync(Ct);
        return whoIsRecords;
    }
}
