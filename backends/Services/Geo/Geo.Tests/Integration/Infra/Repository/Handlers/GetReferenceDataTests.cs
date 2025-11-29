// -----------------------------------------------------------------------
// <copyright file="GetReferenceDataTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.Infra.Repository.Handlers;

using D2.Contracts.Handler;
using D2.Geo.App.Interfaces.Repository.Handlers.R;
using D2.Geo.Infra.Repository;
using D2.Geo.Infra.Repository.Handlers.R;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;

/// <summary>
/// Integration tests for the GetReferenceData handler.
/// </summary>
[MustDisposeResource(false)]
public class GetReferenceDataTests : IAsyncLifetime
{
    private PostgreSqlContainer _container = null!;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:18")
            .Build();

        await _container.StartAsync(Ct);

        var options = new DbContextOptionsBuilder<GeoDbContext>()
            .UseNpgsql(_container.GetConnectionString())
            .Options;

        _db = new GeoDbContext(options);

        // Apply migrations (includes seed data).
        await _db.Database.MigrateAsync(Ct);

        _context = CreateHandlerContext();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _container.DisposeAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Tests that GetReferenceData returns all seeded reference data.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_ReturnsAllSeededReferenceData()
    {
        // Arrange
        var handler = new GetReferenceData(_db, _context);
        var input = new IRead.GetReferenceDataInput();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();

        var data = result.Data!.Data;

        // Verify counts match seed data.
        data.Countries.Should().HaveCountGreaterThanOrEqualTo(249);
        data.Subdivisions.Should().HaveCountGreaterThanOrEqualTo(183);
        data.Currencies.Should().HaveCountGreaterThanOrEqualTo(5);
        data.Languages.Should().HaveCountGreaterThanOrEqualTo(6);
        data.Locales.Should().HaveCountGreaterThanOrEqualTo(100);
        data.GeopoliticalEntities.Should().HaveCountGreaterThanOrEqualTo(53);

        // Verify version.
        data.Version.Should().NotBeNullOrWhiteSpace();
    }

    /// <summary>
    /// Tests that countries include their relationships.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_CountriesIncludeRelationships()
    {
        // Arrange
        var handler = new GetReferenceData(_db, _context);
        var input = new IRead.GetReferenceDataInput();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();

        var us = result.Data!.Data.Countries["US"];
        us.SubdivisionIso31662Codes.Should().HaveCount(51); // 50 states + DC
        us.CurrencyIso4217AlphaCodes.Should().Contain("USD");
        us.GeopoliticalEntityShortCodes.Should().Contain("NATO");
        us.GeopoliticalEntityShortCodes.Should().Contain("USMCA");
        us.GeopoliticalEntityShortCodes.Should().Contain("G7");
    }

    /// <summary>
    /// Tests that geopolitical entities include member countries.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_GeopoliticalEntitiesIncludeMemberCountries()
    {
        // Arrange
        var handler = new GetReferenceData(_db, _context);
        var input = new IRead.GetReferenceDataInput();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();

        var nato = result.Data!.Data.GeopoliticalEntities["NATO"];
        nato.CountryIso31661Alpha2Codes.Should().Contain("US");
        nato.CountryIso31661Alpha2Codes.Should().Contain("GB");
        nato.CountryIso31661Alpha2Codes.Should().Contain("CA");
        nato.CountryIso31661Alpha2Codes.Should().HaveCount(32);
    }

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
