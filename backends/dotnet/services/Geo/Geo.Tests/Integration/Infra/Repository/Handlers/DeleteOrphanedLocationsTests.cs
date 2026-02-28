// -----------------------------------------------------------------------
// <copyright file="DeleteOrphanedLocationsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.Infra.Repository.Handlers;

using D2.Geo.App.Interfaces.Repository.Handlers.D;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Infra.Repository.Handlers.D;
using D2.Geo.Tests.Fixtures;
using D2.Shared.Handler;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

/// <summary>
/// Integration tests for <see cref="DeleteOrphanedLocations"/>.
/// Verifies that only locations with zero contact and zero WhoIs references are deleted.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(false)]
public class DeleteOrphanedLocationsTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteOrphanedLocationsTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public DeleteOrphanedLocationsTests(SharedPostgresFixture fixture)
    {
        r_fixture = fixture;
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public ValueTask InitializeAsync()
    {
        _db = r_fixture.CreateDbContext();
        _context = CreateHandlerContext();
        _options = Options.Create(new GeoInfraOptions { RepoBatchSize = 500 });
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
    }

    #region Empty Database

    /// <summary>
    /// Verifies that an empty locations table returns zero deleted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenNoLocationsExist_ReturnsZero()
    {
        // Clean shared database — other test classes may leave orphaned locations.
        await _db.WhoIsRecords.ExecuteDeleteAsync(Ct);
        await _db.Contacts.ExecuteDeleteAsync(Ct);
        await _db.Locations.ExecuteDeleteAsync(Ct);

        var handler = new DeleteOrphanedLocations(_db, _options, _context);
        var input = new IDelete.DeleteOrphanedLocationsInput();

        var result = await handler.HandleAsync(input, Ct);

        result.Success.Should().BeTrue();
        result.Data!.RowsAffected.Should().Be(0);
    }

    #endregion

    #region Only Orphaned Locations

    /// <summary>
    /// Verifies that locations with no references are deleted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenAllLocationsOrphaned_DeletesAll()
    {
        // Arrange — seed 3 orphaned locations
        var suffix = Guid.NewGuid().ToString("N");
        var loc1 = Location.Create(city: $"Orphan1 {suffix}", countryISO31661Alpha2Code: "US");
        var loc2 = Location.Create(city: $"Orphan2 {suffix}", countryISO31661Alpha2Code: "GB");
        var loc3 = Location.Create(city: $"Orphan3 {suffix}", countryISO31661Alpha2Code: "FR");

        _db.Locations.AddRange(loc1, loc2, loc3);
        await _db.SaveChangesAsync(Ct);

        var handler = new DeleteOrphanedLocations(_db, _options, _context);
        var input = new IDelete.DeleteOrphanedLocationsInput();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.RowsAffected.Should().BeGreaterThanOrEqualTo(3);

        var hashIds = new[] { loc1.HashId, loc2.HashId, loc3.HashId };
        var remaining = await _db.Locations
            .Where(l => hashIds.Contains(l.HashId))
            .ToListAsync(Ct);
        remaining.Should().BeEmpty();
    }

    #endregion

    #region Referenced Locations Preserved

    /// <summary>
    /// Verifies that locations referenced by a contact are NOT deleted, while orphans are.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenLocationReferencedByContact_PreservesIt()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var referencedLoc = Location.Create(city: $"Referenced {suffix}", countryISO31661Alpha2Code: "US");
        var orphanedLoc = Location.Create(city: $"Orphan {suffix}", countryISO31661Alpha2Code: "CA");

        _db.Locations.AddRange(referencedLoc, orphanedLoc);
        await _db.SaveChangesAsync(Ct);

        // Create a contact that references the first location
        var contact = Contact.Create(
            contextKey: "test-integration",
            relatedEntityId: Guid.NewGuid(),
            locationHashId: referencedLoc.HashId);
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = new DeleteOrphanedLocations(_db, _options, _context);
        var input = new IDelete.DeleteOrphanedLocationsInput();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();

        // Orphaned location should be deleted
        var orphanExists = await _db.Locations.AnyAsync(l => l.HashId == orphanedLoc.HashId, Ct);
        orphanExists.Should().BeFalse();

        // Referenced location should be preserved
        var referencedExists = await _db.Locations.AnyAsync(l => l.HashId == referencedLoc.HashId, Ct);
        referencedExists.Should().BeTrue();

        // Cleanup
        _db.Contacts.Remove(contact);
        await _db.SaveChangesAsync(Ct);
    }

    /// <summary>
    /// Verifies that locations referenced by a WhoIs record are NOT deleted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenLocationReferencedByWhoIs_PreservesIt()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var referencedLoc = Location.Create(city: $"WhoIsRef {suffix}", countryISO31661Alpha2Code: "DE");
        var orphanedLoc = Location.Create(city: $"WhoIsOrphan {suffix}", countryISO31661Alpha2Code: "JP");

        _db.Locations.AddRange(referencedLoc, orphanedLoc);
        await _db.SaveChangesAsync(Ct);

        // Create a WhoIs that references the first location
        var whoIs = WhoIs.Create(
            ipAddress: $"10.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}.1",
            year: 2025,
            month: 1,
            fingerprint: $"fp-{suffix}");
        whoIs = whoIs with { LocationHashId = referencedLoc.HashId };
        _db.WhoIsRecords.Add(whoIs);
        await _db.SaveChangesAsync(Ct);

        var handler = new DeleteOrphanedLocations(_db, _options, _context);
        var input = new IDelete.DeleteOrphanedLocationsInput();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();

        // Orphaned should be deleted
        var orphanExists = await _db.Locations.AnyAsync(l => l.HashId == orphanedLoc.HashId, Ct);
        orphanExists.Should().BeFalse();

        // Referenced should be preserved
        var referencedExists = await _db.Locations.AnyAsync(l => l.HashId == referencedLoc.HashId, Ct);
        referencedExists.Should().BeTrue();

        // Cleanup
        _db.WhoIsRecords.Remove(whoIs);
        await _db.SaveChangesAsync(Ct);
    }

    #endregion

    #region Batch Boundary

    /// <summary>
    /// Verifies that orphaned locations exceeding batch size are fully deleted across multiple batches.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenOrphansExceedBatchSize_DeletesAllInMultipleBatches()
    {
        // Arrange — small batch size, more orphans than batch
        const int batch_size = 3;
        const int orphan_count = 7;
        var suffix = Guid.NewGuid().ToString("N");

        var orphans = Enumerable.Range(0, orphan_count)
            .Select(i => Location.Create(
                city: $"BatchOrphan-{i}-{suffix}",
                countryISO31661Alpha2Code: "US"))
            .ToList();

        _db.Locations.AddRange(orphans);
        await _db.SaveChangesAsync(Ct);

        // Use a small batch size to test multi-batch deletion.
        var smallBatchOptions = Options.Create(new GeoInfraOptions { RepoBatchSize = batch_size });
        var handler = new DeleteOrphanedLocations(_db, smallBatchOptions, _context);
        var input = new IDelete.DeleteOrphanedLocationsInput();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.RowsAffected.Should().BeGreaterThanOrEqualTo(orphan_count);

        var hashIds = orphans.Select(l => l.HashId).ToHashSet();
        var remaining = await _db.Locations
            .Where(l => hashIds.Contains(l.HashId))
            .ToListAsync(Ct);
        remaining.Should().BeEmpty();
    }

    #endregion

    #region Mixed References

    /// <summary>
    /// Verifies correct behavior with a mix of Contact-referenced, WhoIs-referenced, and orphaned locations.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WithMixedReferences_OnlyDeletesOrphans()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var contactRefLoc = Location.Create(city: $"ContactRef {suffix}", countryISO31661Alpha2Code: "US");
        var whoIsRefLoc = Location.Create(city: $"WhoIsRef {suffix}", countryISO31661Alpha2Code: "GB");
        var orphan1 = Location.Create(city: $"MixOrphan1 {suffix}", countryISO31661Alpha2Code: "FR");
        var orphan2 = Location.Create(city: $"MixOrphan2 {suffix}", countryISO31661Alpha2Code: "DE");

        _db.Locations.AddRange(contactRefLoc, whoIsRefLoc, orphan1, orphan2);
        await _db.SaveChangesAsync(Ct);

        var contact = Contact.Create("test-mix", Guid.NewGuid(), locationHashId: contactRefLoc.HashId);
        _db.Contacts.Add(contact);

        var whoIs = WhoIs.Create(
            $"172.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}.1", 2025, 6, $"mix-{suffix}");
        whoIs = whoIs with { LocationHashId = whoIsRefLoc.HashId };
        _db.WhoIsRecords.Add(whoIs);
        await _db.SaveChangesAsync(Ct);

        var handler = new DeleteOrphanedLocations(_db, _options, _context);
        var input = new IDelete.DeleteOrphanedLocationsInput();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();

        // Orphans deleted
        (await _db.Locations.AnyAsync(l => l.HashId == orphan1.HashId, Ct)).Should().BeFalse();
        (await _db.Locations.AnyAsync(l => l.HashId == orphan2.HashId, Ct)).Should().BeFalse();

        // Referenced preserved
        (await _db.Locations.AnyAsync(l => l.HashId == contactRefLoc.HashId, Ct)).Should().BeTrue();
        (await _db.Locations.AnyAsync(l => l.HashId == whoIsRefLoc.HashId, Ct)).Should().BeTrue();

        // Cleanup
        _db.Contacts.Remove(contact);
        _db.WhoIsRecords.Remove(whoIs);
        await _db.SaveChangesAsync(Ct);
    }

    #endregion

    /// <summary>
    /// Creates a mocked <see cref="IHandlerContext"/> with a test trace ID.
    /// </summary>
    ///
    /// <returns>The mocked handler context.</returns>
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
