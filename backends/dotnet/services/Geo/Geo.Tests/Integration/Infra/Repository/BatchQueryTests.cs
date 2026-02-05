// -----------------------------------------------------------------------
// <copyright file="BatchQueryTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.Infra.Repository;

using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using D2.Geo.Infra.Repository;
using D2.Geo.Tests.Fixtures;
using D2.Shared.Batch.Pg;
using FluentAssertions;
using JetBrains.Annotations;
using Xunit;

/// <summary>
/// Integration tests for <see cref="BatchQuery{TEntity,TKey}"/>.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(value: false)]
public class BatchQueryTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="BatchQueryTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public BatchQueryTests(SharedPostgresFixture fixture)
    {
        r_fixture = fixture;
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public ValueTask InitializeAsync()
    {
        _db = r_fixture.CreateDbContext();
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync().ConfigureAwait(false);
    }

    #region ToListAsync Tests

    /// <summary>
    /// Tests that ToListAsync returns empty list when no IDs are provided.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ToListAsync_WithEmptyIds_ReturnsEmptyList()
    {
        // Arrange
        var query = _db.Locations.BatchGetByIds<Location, string>(
            [],
            l => l.HashId);

        // Act
        var result = await query.ToListAsync(Ct);

        // Assert
        result.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that ToListAsync returns all matching entities.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ToListAsync_WithExistingIds_ReturnsAllEntities()
    {
        // Arrange - Create test locations with unique data
        var suffix = Guid.NewGuid().ToString("N");
        var locations = new List<Location>
        {
            Location.Create(
                coordinates: Coordinates.Create(34.0522, -118.2437),
                city: $"Los Angeles {suffix}",
                countryISO31661Alpha2Code: "US"),
            Location.Create(
                coordinates: Coordinates.Create(40.7128, -74.0060),
                city: $"New York {suffix}",
                countryISO31661Alpha2Code: "US"),
            Location.Create(
                coordinates: Coordinates.Create(51.5074, -0.1278),
                city: $"London {suffix}",
                countryISO31661Alpha2Code: "GB"),
        };
        _db.Locations.AddRange(locations);
        await _db.SaveChangesAsync(Ct);

        var hashIds = locations.Select(l => l.HashId).ToList();
        var query = _db.Locations.BatchGetByIds(hashIds, l => l.HashId);

        // Act
        var result = await query.ToListAsync(Ct);

        // Assert
        result.Should().HaveCount(3);
        result.Select(l => l.City).Should().BeEquivalentTo([$"Los Angeles {suffix}", $"New York {suffix}", $"London {suffix}"]);
    }

    /// <summary>
    /// Tests that ToListAsync handles large batches correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ToListAsync_WithLargeBatch_HandlesBatchingCorrectly()
    {
        // Arrange - Create 150 locations (more than default batch size)
        var suffix = Guid.NewGuid().ToString("N");
        var locations = Enumerable.Range(0, 150)
            .Select(i => Location.Create(
                coordinates: Coordinates.Create(i * 0.01, i * 0.01),
                city: $"City{i}_{suffix}",
                countryISO31661Alpha2Code: "US"))
            .ToList();
        _db.Locations.AddRange(locations);
        await _db.SaveChangesAsync(Ct);

        var hashIds = locations.Select(l => l.HashId).ToList();
        var query = _db.Locations.BatchGetByIds(
            hashIds,
            l => l.HashId,
            opts => opts.BatchSize = 50); // Force 3 batches

        // Act
        var result = await query.ToListAsync(Ct);

        // Assert
        result.Should().HaveCount(150);
    }

    /// <summary>
    /// Tests that ToListAsync returns partial results when some IDs don't exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ToListAsync_WithSomeMissingIds_ReturnsOnlyExisting()
    {
        // Arrange
        var existingLocation = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            city: $"Existing {Guid.NewGuid():N}",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(existingLocation);
        await _db.SaveChangesAsync(Ct);

        var nonExistentId = "0000000000000000000000000000000000000000000000000000000000000000";
        var query = _db.Locations.BatchGetByIds(
            [existingLocation.HashId, nonExistentId],
            l => l.HashId);

        // Act
        var result = await query.ToListAsync(Ct);

        // Assert
        result.Should().HaveCount(1);
        result[0].HashId.Should().Be(existingLocation.HashId);
    }

    #endregion

    #region GetMissingIdsAsync Tests

    /// <summary>
    /// Tests that GetMissingIdsAsync returns all IDs when none exist in the database.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetMissingIdsAsync_WhenNoneExist_ReturnsAllIds()
    {
        // Arrange
        var nonExistentIds = new List<string>
        {
            "0000000000000000000000000000000000000000000000000000000000000001",
            "0000000000000000000000000000000000000000000000000000000000000002",
            "0000000000000000000000000000000000000000000000000000000000000003",
        };
        var query = _db.Locations.BatchGetByIds(nonExistentIds, l => l.HashId);

        // Act
        var result = await query.GetMissingIdsAsync(Ct);

        // Assert
        result.Should().HaveCount(3);
        result.Should().BeEquivalentTo(nonExistentIds);
    }

    /// <summary>
    /// Tests that GetMissingIdsAsync returns empty set when all IDs exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetMissingIdsAsync_WhenAllExist_ReturnsEmptySet()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var locations = new List<Location>
        {
            Location.Create(
                coordinates: Coordinates.Create(34.0522, -118.2437),
                city: $"Los Angeles {suffix}",
                countryISO31661Alpha2Code: "US"),
            Location.Create(
                coordinates: Coordinates.Create(40.7128, -74.0060),
                city: $"New York {suffix}",
                countryISO31661Alpha2Code: "US"),
        };
        _db.Locations.AddRange(locations);
        await _db.SaveChangesAsync(Ct);

        var hashIds = locations.Select(l => l.HashId).ToList();
        var query = _db.Locations.BatchGetByIds(hashIds, l => l.HashId);

        // Act
        var result = await query.GetMissingIdsAsync(Ct);

        // Assert
        result.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that GetMissingIdsAsync returns only the missing IDs.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetMissingIdsAsync_WhenSomeExist_ReturnsOnlyMissing()
    {
        // Arrange
        var existingLocation = Location.Create(
            coordinates: Coordinates.Create(34.0522, -118.2437),
            city: $"Existing {Guid.NewGuid():N}",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(existingLocation);
        await _db.SaveChangesAsync(Ct);

        var nonExistentId = "0000000000000000000000000000000000000000000000000000000000000000";
        var query = _db.Locations.BatchGetByIds(
            [existingLocation.HashId, nonExistentId],
            l => l.HashId);

        // Act
        var result = await query.GetMissingIdsAsync(Ct);

        // Assert
        result.Should().HaveCount(1);
        result.Should().Contain(nonExistentId);
        result.Should().NotContain(existingLocation.HashId);
    }

    /// <summary>
    /// Tests that GetMissingIdsAsync handles empty input correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetMissingIdsAsync_WithEmptyInput_ReturnsEmptySet()
    {
        // Arrange
        var query = _db.Locations.BatchGetByIds<Location, string>(
            [],
            l => l.HashId);

        // Act
        var result = await query.GetMissingIdsAsync(Ct);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region BatchCount Tests

    /// <summary>
    /// Tests that BatchCount returns 0 when no IDs are provided.
    /// </summary>
    [Fact]
    public void BatchCount_WithEmptyIds_ReturnsZero()
    {
        // Arrange
        var query = _db.Locations.BatchGetByIds<Location, string>(
            [],
            l => l.HashId);

        // Act & Assert
        query.BatchCount.Should().Be(0);
    }

    /// <summary>
    /// Tests that BatchCount returns 1 when IDs fit in a single batch.
    /// </summary>
    [Fact]
    public void BatchCount_WithIdsFittingInSingleBatch_ReturnsOne()
    {
        // Arrange
        var ids = Enumerable.Range(0, 50).Select(i => $"id-{i}").ToList();
        var query = _db.Locations.BatchGetByIds(
            ids,
            l => l.HashId,
            opts => opts.BatchSize = 100);

        // Act & Assert
        query.BatchCount.Should().Be(1);
    }

    /// <summary>
    /// Tests that BatchCount returns correct number for multiple batches.
    /// </summary>
    [Fact]
    public void BatchCount_WithIdsRequiringMultipleBatches_ReturnsCorrectCount()
    {
        // Arrange
        var ids = Enumerable.Range(0, 250).Select(i => $"id-{i}").ToList();
        var query = _db.Locations.BatchGetByIds(
            ids,
            l => l.HashId,
            opts => opts.BatchSize = 100);

        // Act & Assert
        query.BatchCount.Should().Be(3); // 100 + 100 + 50
    }

    /// <summary>
    /// Tests that BatchCount handles exact batch size boundary correctly.
    /// </summary>
    [Fact]
    public void BatchCount_WithExactBatchSize_ReturnsCorrectCount()
    {
        // Arrange
        var ids = Enumerable.Range(0, 200).Select(i => $"id-{i}").ToList();
        var query = _db.Locations.BatchGetByIds(
            ids,
            l => l.HashId,
            opts => opts.BatchSize = 100);

        // Act & Assert
        query.BatchCount.Should().Be(2);
    }

    #endregion
}
