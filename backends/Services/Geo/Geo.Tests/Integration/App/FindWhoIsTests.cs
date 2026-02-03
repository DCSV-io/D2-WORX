// -----------------------------------------------------------------------
// <copyright file="FindWhoIsTests.cs" company="DCSV">
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
using D2.Geo.App.Implementations.CQRS.Handlers.X;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.App.Interfaces.CQRS.Handlers.X;
using D2.Geo.App.Interfaces.Repository.Handlers.C;
using D2.Geo.Domain.Entities;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Infra.Repository.Handlers.C;
using D2.Services.Protos.Geo.V1;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
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
using GetWhoIsByIdsCqrs = D2.Geo.App.Implementations.CQRS.Handlers.Q.GetWhoIsByIds;
using GetWhoIsByIdsRepo = D2.Geo.Infra.Repository.Handlers.R.GetWhoIsByIds;
using RepoRead = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead;
using WhoIsRead = D2.Geo.App.Interfaces.WhoIs.Handlers.R.IRead;

/// <summary>
/// Integration tests for the <see cref="FindWhoIs"/> CQRS handler.
/// </summary>
[MustDisposeResource(false)]
public class FindWhoIsTests : IAsyncLifetime
{
    private PostgreSqlContainer _pgContainer = null!;
    private ServiceProvider _services = null!;
    private IServiceScope _scope = null!;
    private GeoDbContext _db = null!;
    private Mock<WhoIsRead.IPopulateHandler> _mockPopulateHandler = null!;

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

        _mockPopulateHandler = new Mock<WhoIsRead.IPopulateHandler>();

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
        services.AddScoped<GeoDbContext>(_ => _db);

        // Register handlers.
        services.AddTransient<IHandlerContext>(_ => CreateHandlerContext());
        services.AddTransient(typeof(CacheRead.IGetManyHandler<>), typeof(GetMany<>));
        services.AddTransient(typeof(CacheUpdate.ISetManyHandler<>), typeof(SetMany<>));
        services.AddTransient<RepoRead.IGetLocationsByIdsHandler, GetLocationsByIdsRepo>();
        services.AddTransient<RepoRead.IGetWhoIsByIdsHandler, GetWhoIsByIdsRepo>();
        services.AddTransient<ICreate.ICreateWhoIsHandler, CreateWhoIs>();
        services.AddTransient<IQueries.IGetLocationsByIdsHandler, GetLocationsByIdsCqrs>();
        services.AddTransient<IQueries.IGetWhoIsByIdsHandler, GetWhoIsByIdsCqrs>();

        // Register mock for external API handler
        services.AddSingleton(_mockPopulateHandler.Object);

        services.AddTransient<IComplex.IFindWhoIsHandler, FindWhoIs>();

        _services = services.BuildServiceProvider();
        _scope = _services.CreateScope();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        _scope.Dispose();
        await _services.DisposeAsync();
        await _db.DisposeAsync();
        await _pgContainer.DisposeAsync().ConfigureAwait(false);
    }

    #region Empty Input Tests

    /// <summary>
    /// Tests that FindWhoIs with empty input returns success with empty dictionary.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task FindWhoIs_WithEmptyInput_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new FindWhoIsRequest();
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
    }

    #endregion

    #region Cache/DB Hit Tests

    /// <summary>
    /// Tests that FindWhoIs returns existing records from database.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task FindWhoIs_WhenRecordsExistInDb_ReturnsThem()
    {
        // Arrange - Create WhoIs records with current year/month
        var now = DateTime.UtcNow;
        var whoIs = WhoIs.Create(
            ipAddress: "192.168.1.100",
            year: now.Year,
            month: now.Month,
            fingerprint: "Mozilla/5.0",
            asn: 12345,
            asName: "Test ISP");
        _db.WhoIsRecords.Add(whoIs);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new FindWhoIsRequest
        {
            Requests =
            {
                new FindWhoIsKeys { IpAddress = "192.168.1.100", Fingerprint = "Mozilla/5.0" },
            },
        };
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);

        var key = request.Requests[0];
        result.Data.Data.Should().ContainKey(key);
        result.Data.Data[key].IpAddress.Should().Be("192.168.1.100");
        result.Data.Data[key].Asn.Should().Be(12345);

        // Populate should not be called
        _mockPopulateHandler.Verify(
            x => x.HandleAsync(It.IsAny<WhoIsRead.PopulateInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that FindWhoIs returns multiple existing records from database.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task FindWhoIs_WithMultipleExistingRecords_ReturnsAll()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var whoIs1 = WhoIs.Create("10.0.0.1", now.Year, now.Month, "fingerprint-1");
        var whoIs2 = WhoIs.Create("10.0.0.2", now.Year, now.Month, "fingerprint-2");
        var whoIs3 = WhoIs.Create("10.0.0.3", now.Year, now.Month, "fingerprint-3");
        _db.WhoIsRecords.AddRange(whoIs1, whoIs2, whoIs3);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new FindWhoIsRequest
        {
            Requests =
            {
                new FindWhoIsKeys { IpAddress = "10.0.0.1", Fingerprint = "fingerprint-1" },
                new FindWhoIsKeys { IpAddress = "10.0.0.2", Fingerprint = "fingerprint-2" },
                new FindWhoIsKeys { IpAddress = "10.0.0.3", Fingerprint = "fingerprint-3" },
            },
        };
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(3);
    }

    #endregion

    #region Population Tests

    /// <summary>
    /// Tests that FindWhoIs calls populate handler for missing records.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task FindWhoIs_WhenRecordsMissing_CallsPopulateHandler()
    {
        // Arrange
        const string ip_address = "8.8.8.8";
        const string fingerprint = "Chrome/120";

        // Setup mock to return populated WhoIs
        _mockPopulateHandler
            .Setup(x => x.HandleAsync(It.IsAny<WhoIsRead.PopulateInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync((WhoIsRead.PopulateInput input, CancellationToken _, HandlerOptions? _) =>
            {
                var populatedRecords = new Dictionary<string, WhoIs>();
                foreach (var (hashId, partialWhoIs) in input.WhoIsRecords)
                {
                    var populated = WhoIs.Create(
                        ipAddress: partialWhoIs.IPAddress,
                        year: partialWhoIs.Year,
                        month: partialWhoIs.Month,
                        fingerprint: partialWhoIs.Fingerprint,
                        asn: 15169,
                        asName: "Google LLC");
                    populatedRecords[hashId] = populated;
                }

                return D2Result<WhoIsRead.PopulateOutput?>.Ok(new WhoIsRead.PopulateOutput(populatedRecords));
            });

        var handler = CreateHandler();
        var request = new FindWhoIsRequest
        {
            Requests =
            {
                new FindWhoIsKeys { IpAddress = ip_address, Fingerprint = fingerprint },
            },
        };
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);

        var key = request.Requests[0];
        result.Data.Data[key].IpAddress.Should().Be(ip_address);
        result.Data.Data[key].Asn.Should().Be(15169);
        result.Data.Data[key].AsName.Should().Be("Google LLC");

        // Verify populate was called
        _mockPopulateHandler.Verify(
            x => x.HandleAsync(It.IsAny<WhoIsRead.PopulateInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()),
            Times.Once);

        // Verify WhoIs was persisted to database
        var dbRecords = await _db.WhoIsRecords.ToListAsync(Ct);
        dbRecords.Should().HaveCount(1);
        dbRecords[0].IPAddress.Should().Be(ip_address);
    }

    /// <summary>
    /// Tests that FindWhoIs handles mixed cache hits and misses.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task FindWhoIs_WithMixedCacheAndMisses_HandlesBothCorrectly()
    {
        // Arrange
        var now = DateTime.UtcNow;

        // Create one existing record
        var existingWhoIs = WhoIs.Create("192.168.1.1", now.Year, now.Month, "existing-fingerprint");
        _db.WhoIsRecords.Add(existingWhoIs);
        await _db.SaveChangesAsync(Ct);

        // Setup mock to populate the missing one
        _mockPopulateHandler
            .Setup(x => x.HandleAsync(It.IsAny<WhoIsRead.PopulateInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync((WhoIsRead.PopulateInput input, CancellationToken _, HandlerOptions? _) =>
            {
                var populatedRecords = new Dictionary<string, WhoIs>();
                foreach (var (hashId, partialWhoIs) in input.WhoIsRecords)
                {
                    var populated = WhoIs.Create(
                        ipAddress: partialWhoIs.IPAddress,
                        year: partialWhoIs.Year,
                        month: partialWhoIs.Month,
                        fingerprint: partialWhoIs.Fingerprint,
                        asn: 99999,
                        asName: "New ISP");
                    populatedRecords[hashId] = populated;
                }

                return D2Result<WhoIsRead.PopulateOutput?>.Ok(new WhoIsRead.PopulateOutput(populatedRecords));
            });

        var handler = CreateHandler();
        var request = new FindWhoIsRequest
        {
            Requests =
            {
                new FindWhoIsKeys { IpAddress = "192.168.1.1", Fingerprint = "existing-fingerprint" },
                new FindWhoIsKeys { IpAddress = "192.168.1.2", Fingerprint = "new-fingerprint" },
            },
        };
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(2);

        // Existing record from DB
        var existingKey = request.Requests[0];
        result.Data.Data[existingKey].IpAddress.Should().Be("192.168.1.1");

        // New record from populate
        var newKey = request.Requests[1];
        result.Data.Data[newKey].IpAddress.Should().Be("192.168.1.2");
        result.Data.Data[newKey].Asn.Should().Be(99999);

        // Verify only the missing record was populated
        _mockPopulateHandler.Verify(
            x => x.HandleAsync(
                It.Is<WhoIsRead.PopulateInput>(i => i.WhoIsRecords.Count == 1),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    #endregion

    #region Error Handling Tests

    /// <summary>
    /// Tests that FindWhoIs returns SOME_FOUND when population fails but some records exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task FindWhoIs_WhenPopulateFails_ReturnsSomeFoundWithExisting()
    {
        // Arrange
        var now = DateTime.UtcNow;

        // Create one existing record
        var existingWhoIs = WhoIs.Create("192.168.1.1", now.Year, now.Month, "existing-fingerprint");
        _db.WhoIsRecords.Add(existingWhoIs);
        await _db.SaveChangesAsync(Ct);

        // Setup mock to fail
        _mockPopulateHandler
            .Setup(x => x.HandleAsync(It.IsAny<WhoIsRead.PopulateInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<WhoIsRead.PopulateOutput?>.Fail(["External API error"]));

        var handler = CreateHandler();
        var request = new FindWhoIsRequest
        {
            Requests =
            {
                new FindWhoIsKeys { IpAddress = "192.168.1.1", Fingerprint = "existing-fingerprint" },
                new FindWhoIsKeys { IpAddress = "192.168.1.2", Fingerprint = "missing-fingerprint" },
            },
        };
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data.Should().NotBeNull();
        result.Data!.Data.Should().HaveCount(1);
    }

    /// <summary>
    /// Tests that FindWhoIs returns NOT_FOUND when all fail.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task FindWhoIs_WhenNothingFoundAndPopulateFails_ReturnsNotFound()
    {
        // Arrange
        _mockPopulateHandler
            .Setup(x => x.HandleAsync(It.IsAny<WhoIsRead.PopulateInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<WhoIsRead.PopulateOutput?>.Fail(["External API error"]));

        var handler = CreateHandler();
        var request = new FindWhoIsRequest
        {
            Requests =
            {
                new FindWhoIsKeys { IpAddress = "1.2.3.4", Fingerprint = "unknown" },
            },
        };
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.NOT_FOUND);
        result.Data.Should().BeNull();
    }

    /// <summary>
    /// Tests that FindWhoIs handles partial population (some IPs succeed, some fail).
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task FindWhoIs_WhenPopulateReturnsPartial_ReturnsSomeFound()
    {
        // Arrange

        // Setup mock to return only one of two requested
        _mockPopulateHandler
            .Setup(x => x.HandleAsync(It.IsAny<WhoIsRead.PopulateInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync((WhoIsRead.PopulateInput input, CancellationToken _, HandlerOptions? _) =>
            {
                // Only populate the first one
                var first = input.WhoIsRecords.First();
                var populated = WhoIs.Create(
                    ipAddress: first.Value.IPAddress,
                    year: first.Value.Year,
                    month: first.Value.Month,
                    fingerprint: first.Value.Fingerprint,
                    asn: 12345,
                    asName: "Partial ISP");

                return D2Result<WhoIsRead.PopulateOutput?>.Ok(
                    new WhoIsRead.PopulateOutput(new Dictionary<string, WhoIs> { [first.Key] = populated }));
            });

        var handler = CreateHandler();
        var request = new FindWhoIsRequest
        {
            Requests =
            {
                new FindWhoIsKeys { IpAddress = "1.1.1.1", Fingerprint = "fp-1" },
                new FindWhoIsKeys { IpAddress = "2.2.2.2", Fingerprint = "fp-2" },
            },
        };
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data!.Data.Should().HaveCount(1);
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

    private IComplex.IFindWhoIsHandler CreateHandler()
    {
        return _scope.ServiceProvider.GetRequiredService<IComplex.IFindWhoIsHandler>();
    }
}
