// -----------------------------------------------------------------------
// <copyright file="BatchQueryTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.BatchPg;

using D2.Shared.Batch.Pg;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

/// <summary>
/// Unit tests for <see cref="BatchQuery{TEntity, TKey}"/>.
/// </summary>
public class BatchQueryTests : IDisposable
{
    private readonly TestDbContext _db;

    /// <summary>
    /// Initializes a new instance of the <see cref="BatchQueryTests"/> class.
    /// </summary>
    public BatchQueryTests()
    {
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _db = new TestDbContext(options);
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Empty Input

    /// <summary>
    /// Tests that an empty input produces zero IdCount.
    /// </summary>
    [Fact]
    public void EmptyInput_IdCount_IsZero()
    {
        // Arrange & Act
        var query = _db.TestEntities.BatchGetByIds(
            Array.Empty<int>(),
            e => e.Id);

        // Assert
        query.IdCount.Should().Be(0);
    }

    /// <summary>
    /// Tests that an empty input produces zero BatchCount.
    /// </summary>
    [Fact]
    public void EmptyInput_BatchCount_IsZero()
    {
        // Arrange & Act
        var query = _db.TestEntities.BatchGetByIds(
            Array.Empty<int>(),
            e => e.Id);

        // Assert
        query.BatchCount.Should().Be(0);
    }

    /// <summary>
    /// Tests that an empty input returns an empty list from ToListAsync.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyInput_ToListAsync_ReturnsEmptyList()
    {
        // Arrange
        var query = _db.TestEntities.BatchGetByIds(
            Array.Empty<int>(),
            e => e.Id);

        // Act
        var result = await query.ToListAsync(Ct);

        // Assert
        result.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that an empty input returns an empty dictionary from ToDictionaryAsync.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyInput_ToDictionaryAsync_ReturnsEmptyDictionary()
    {
        // Arrange
        var query = _db.TestEntities.BatchGetByIds(
            Array.Empty<int>(),
            e => e.Id);

        // Act
        var result = await query.ToDictionaryAsync(Ct);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region Single Batch (Input Smaller Than Batch Size)

    /// <summary>
    /// Tests that input smaller than batch size produces correct IdCount.
    /// </summary>
    [Fact]
    public void InputSmallerThanBatchSize_IdCount_MatchesInputCount()
    {
        // Arrange
        var ids = new[] { 1, 2, 3 };

        // Act
        var query = _db.TestEntities.BatchGetByIds(ids, e => e.Id);

        // Assert
        query.IdCount.Should().Be(3);
    }

    /// <summary>
    /// Tests that input smaller than batch size produces single batch.
    /// </summary>
    [Fact]
    public void InputSmallerThanBatchSize_BatchCount_IsOne()
    {
        // Arrange
        var ids = new[] { 1, 2, 3 };

        // Act
        var query = _db.TestEntities.BatchGetByIds(ids, e => e.Id);

        // Assert
        query.BatchCount.Should().Be(1);
    }

    /// <summary>
    /// Tests that input equal to batch size produces single batch.
    /// </summary>
    [Fact]
    public void InputEqualToBatchSize_BatchCount_IsOne()
    {
        // Arrange
        var ids = Enumerable.Range(1, 500).ToArray();

        // Act
        var query = _db.TestEntities.BatchGetByIds(ids, e => e.Id);

        // Assert
        query.BatchCount.Should().Be(1);
    }

    #endregion

    #region Multiple Batches (Input Larger Than Batch Size)

    /// <summary>
    /// Tests that input larger than batch size produces multiple batches.
    /// </summary>
    [Fact]
    public void InputLargerThanBatchSize_BatchCount_IsMultiple()
    {
        // Arrange — 501 IDs with default batch size of 500
        var ids = Enumerable.Range(1, 501).ToArray();

        // Act
        var query = _db.TestEntities.BatchGetByIds(ids, e => e.Id);

        // Assert
        query.BatchCount.Should().Be(2);
    }

    /// <summary>
    /// Tests that 1000 IDs with default batch size produces exactly 2 batches.
    /// </summary>
    [Fact]
    public void OneThousandIds_DefaultBatchSize_ProducesTwoBatches()
    {
        // Arrange
        var ids = Enumerable.Range(1, 1000).ToArray();

        // Act
        var query = _db.TestEntities.BatchGetByIds(ids, e => e.Id);

        // Assert
        query.BatchCount.Should().Be(2);
    }

    /// <summary>
    /// Tests that 1001 IDs with default batch size produces 3 batches.
    /// </summary>
    [Fact]
    public void OneThousandOneIds_DefaultBatchSize_ProducesThreeBatches()
    {
        // Arrange
        var ids = Enumerable.Range(1, 1001).ToArray();

        // Act
        var query = _db.TestEntities.BatchGetByIds(ids, e => e.Id);

        // Assert
        query.BatchCount.Should().Be(3);
    }

    #endregion

    #region Custom Batch Size

    /// <summary>
    /// Tests that a custom batch size from options is respected.
    /// </summary>
    [Fact]
    public void CustomBatchSize_IsRespected()
    {
        // Arrange — 10 IDs with batch size of 3
        var ids = Enumerable.Range(1, 10).ToArray();

        // Act
        var query = _db.TestEntities.BatchGetByIds(
            ids,
            e => e.Id,
            opts => opts.BatchSize = 3);

        // Assert
        query.BatchCount.Should().Be(4); // ceil(10/3) = 4
        query.IdCount.Should().Be(10);
    }

    /// <summary>
    /// Tests that batch size of 1 produces one batch per ID.
    /// </summary>
    [Fact]
    public void BatchSizeOfOne_ProducesOneBatchPerElement()
    {
        // Arrange
        var ids = new[] { 1, 2, 3, 4, 5 };

        // Act
        var query = _db.TestEntities.BatchGetByIds(
            ids,
            e => e.Id,
            opts => opts.BatchSize = 1);

        // Assert
        query.BatchCount.Should().Be(5);
    }

    #endregion

    #region Deduplication

    /// <summary>
    /// Tests that duplicate IDs are removed when DeduplicateIds is true (default).
    /// </summary>
    [Fact]
    public void DeduplicateIdsEnabled_DuplicatesRemoved()
    {
        // Arrange
        var ids = new[] { 1, 2, 2, 3, 3, 3 };

        // Act
        var query = _db.TestEntities.BatchGetByIds(ids, e => e.Id);

        // Assert
        query.IdCount.Should().Be(3);
    }

    /// <summary>
    /// Tests that duplicate IDs are kept when DeduplicateIds is false.
    /// </summary>
    [Fact]
    public void DeduplicateIdsDisabled_DuplicatesKept()
    {
        // Arrange
        var ids = new[] { 1, 2, 2, 3, 3, 3 };

        // Act
        var query = _db.TestEntities.BatchGetByIds(
            ids,
            e => e.Id,
            opts => opts.DeduplicateIds = false);

        // Assert
        query.IdCount.Should().Be(6);
    }

    #endregion

    #region Null/Default Filtering

    /// <summary>
    /// Tests that default (zero) IDs are filtered out when FilterNullIds is true (default).
    /// </summary>
    [Fact]
    public void FilterNullIdsEnabled_DefaultValuesRemoved()
    {
        // Arrange
        var ids = new[] { 0, 1, 0, 2, 3 };

        // Act
        var query = _db.TestEntities.BatchGetByIds(ids, e => e.Id);

        // Assert
        query.IdCount.Should().Be(3);
    }

    /// <summary>
    /// Tests that default Guid IDs are filtered out when FilterNullIds is true (default).
    /// </summary>
    [Fact]
    public void FilterNullIdsEnabled_DefaultGuidValuesRemoved()
    {
        // Arrange
        var validGuid1 = Guid.NewGuid();
        var validGuid2 = Guid.NewGuid();
        var ids = new[] { Guid.Empty, validGuid1, Guid.Empty, validGuid2 };

        // Act
        var query = _db.GuidEntities.BatchGetByIds(ids, e => e.Id);

        // Assert
        query.IdCount.Should().Be(2);
    }

    /// <summary>
    /// Tests that default IDs are kept when FilterNullIds is false.
    /// DeduplicateIds must also be false to keep duplicate 0 values.
    /// </summary>
    [Fact]
    public void FilterNullIdsDisabled_DefaultValuesKept()
    {
        // Arrange
        var ids = new[] { 0, 1, 0, 2, 3 };

        // Act
        var query = _db.TestEntities.BatchGetByIds(
            ids,
            e => e.Id,
            opts =>
            {
                opts.FilterNullIds = false;
                opts.DeduplicateIds = false;
            });

        // Assert
        query.IdCount.Should().Be(5);
    }

    #endregion

    #region ToListAsync (With Data)

    /// <summary>
    /// Tests that ToListAsync returns matching entities from the database.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToListAsync_WithExistingEntities_ReturnsMatchingEntities()
    {
        // Arrange
        _db.TestEntities.AddRange(
            new TestEntity { Id = 1, Name = "One" },
            new TestEntity { Id = 2, Name = "Two" },
            new TestEntity { Id = 3, Name = "Three" });
        await _db.SaveChangesAsync(Ct);

        var query = _db.TestEntities.BatchGetByIds(
            new[] { 1, 3 },
            e => e.Id);

        // Act
        var result = await query.ToListAsync(Ct);

        // Assert
        result.Should().HaveCount(2);
        result.Select(e => e.Id).Should().BeEquivalentTo([1, 3]);
    }

    /// <summary>
    /// Tests that ToListAsync returns only found entities when some IDs are missing.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToListAsync_WithSomeMissingIds_ReturnsOnlyFoundEntities()
    {
        // Arrange
        _db.TestEntities.Add(new TestEntity { Id = 1, Name = "One" });
        await _db.SaveChangesAsync(Ct);

        var query = _db.TestEntities.BatchGetByIds(
            new[] { 1, 99 },
            e => e.Id);

        // Act
        var result = await query.ToListAsync(Ct);

        // Assert
        result.Should().HaveCount(1);
        result[0].Id.Should().Be(1);
    }

    #endregion

    #region ToDictionaryAsync (With Data)

    /// <summary>
    /// Tests that ToDictionaryAsync returns entities keyed by their IDs.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToDictionaryAsync_WithExistingEntities_ReturnsDictionaryKeyedById()
    {
        // Arrange
        _db.TestEntities.AddRange(
            new TestEntity { Id = 1, Name = "One" },
            new TestEntity { Id = 2, Name = "Two" });
        await _db.SaveChangesAsync(Ct);

        var query = _db.TestEntities.BatchGetByIds(
            new[] { 1, 2 },
            e => e.Id);

        // Act
        var result = await query.ToDictionaryAsync(Ct);

        // Assert
        result.Should().HaveCount(2);
        result[1].Name.Should().Be("One");
        result[2].Name.Should().Be("Two");
    }

    #endregion

    #region GetMissingIdsAsync

    /// <summary>
    /// Tests that GetMissingIdsAsync returns IDs that were not found in the database.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task GetMissingIdsAsync_WithSomeMissingIds_ReturnsMissingIds()
    {
        // Arrange
        _db.TestEntities.Add(new TestEntity { Id = 1, Name = "One" });
        await _db.SaveChangesAsync(Ct);

        var query = _db.TestEntities.BatchGetByIds(
            new[] { 1, 2, 3 },
            e => e.Id);

        // Act
        var missingIds = await query.GetMissingIdsAsync(Ct);

        // Assert
        missingIds.Should().BeEquivalentTo([2, 3]);
    }

    /// <summary>
    /// Tests that GetMissingIdsAsync returns empty set when all IDs are found.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task GetMissingIdsAsync_WhenAllFound_ReturnsEmptySet()
    {
        // Arrange
        _db.TestEntities.AddRange(
            new TestEntity { Id = 1, Name = "One" },
            new TestEntity { Id = 2, Name = "Two" });
        await _db.SaveChangesAsync(Ct);

        var query = _db.TestEntities.BatchGetByIds(
            new[] { 1, 2 },
            e => e.Id);

        // Act
        var missingIds = await query.GetMissingIdsAsync(Ct);

        // Assert
        missingIds.Should().BeEmpty();
    }

    #endregion

    /// <inheritdoc/>
    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Test Infrastructure

    /// <summary>
    /// A simple test entity for BatchQuery tests.
    /// </summary>
    public class TestEntity
    {
        /// <summary>
        /// Gets or sets the entity ID.
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Gets or sets the entity name.
        /// </summary>
        public string Name { get; set; } = string.Empty;
    }

    /// <summary>
    /// A test entity with a Guid key for BatchQuery tests.
    /// </summary>
    public class GuidEntity
    {
        /// <summary>
        /// Gets or sets the entity ID.
        /// </summary>
        public Guid Id { get; set; }

        /// <summary>
        /// Gets or sets the entity name.
        /// </summary>
        public string Name { get; set; } = string.Empty;
    }

    /// <summary>
    /// A test DbContext for BatchQuery tests.
    /// </summary>
    public class TestDbContext : DbContext
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="TestDbContext"/> class.
        /// </summary>
        ///
        /// <param name="options">
        /// The DbContext options.
        /// </param>
        public TestDbContext(DbContextOptions<TestDbContext> options)
            : base(options)
        {
        }

        /// <summary>
        /// Gets or sets the test entities.
        /// </summary>
        public DbSet<TestEntity> TestEntities { get; set; } = null!;

        /// <summary>
        /// Gets or sets the GUID entities.
        /// </summary>
        public DbSet<GuidEntity> GuidEntities { get; set; } = null!;
    }

    #endregion
}
