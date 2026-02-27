// -----------------------------------------------------------------------
// <copyright file="BatchD2ResultExtensionsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.BatchPg;

using D2.Shared.Batch.Pg;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

/// <summary>
/// Unit tests for <see cref="D2ResultExtensions"/>.
/// </summary>
public class BatchD2ResultExtensionsTests : IDisposable
{
    private const string _TRACE_ID = "test-trace-id-123";
    private readonly TestDbContext _db;

    /// <summary>
    /// Initializes a new instance of the <see cref="BatchD2ResultExtensionsTests"/> class.
    /// </summary>
    public BatchD2ResultExtensionsTests()
    {
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _db = new TestDbContext(options);
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region ToD2ResultAsync — Empty Input

    /// <summary>
    /// Tests that empty input returns Ok with empty list.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToD2ResultAsync_EmptyInput_ReturnsOkWithEmptyList()
    {
        // Arrange
        var query = _db.TestEntities.BatchGetByIds(
            Array.Empty<int>(),
            e => e.Id);

        // Act
        var result = await query.ToD2ResultAsync(_TRACE_ID, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data.Should().BeEmpty();
        result.TraceId.Should().Be(_TRACE_ID);
    }

    #endregion

    #region ToD2ResultAsync — All Found (Ok)

    /// <summary>
    /// Tests that when all requested IDs are found, result is Ok.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToD2ResultAsync_AllFound_ReturnsOk()
    {
        // Arrange
        _db.TestEntities.AddRange(
            new TestEntity { Id = 1, Name = "One" },
            new TestEntity { Id = 2, Name = "Two" },
            new TestEntity { Id = 3, Name = "Three" });
        await _db.SaveChangesAsync(Ct);

        var query = _db.TestEntities.BatchGetByIds(
            new[] { 1, 2, 3 },
            e => e.Id);

        // Act
        var result = await query.ToD2ResultAsync(_TRACE_ID, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().HaveCount(3);
        result.TraceId.Should().Be(_TRACE_ID);
    }

    #endregion

    #region ToD2ResultAsync — None Found (NotFound)

    /// <summary>
    /// Tests that when no requested IDs are found, result is NotFound.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToD2ResultAsync_NoneFound_ReturnsNotFound()
    {
        // Arrange — no data in DB
        var query = _db.TestEntities.BatchGetByIds(
            new[] { 99, 100 },
            e => e.Id);

        // Act
        var result = await query.ToD2ResultAsync(_TRACE_ID, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.NOT_FOUND);
        result.Data.Should().BeNull();
        result.TraceId.Should().Be(_TRACE_ID);
    }

    #endregion

    #region ToD2ResultAsync — Partial Success (SomeFound)

    /// <summary>
    /// Tests that when only some requested IDs are found, result is SomeFound with data.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToD2ResultAsync_SomeFound_ReturnsSomeFoundWithData()
    {
        // Arrange — only 1 of 3 requested entities exists
        _db.TestEntities.Add(new TestEntity { Id = 1, Name = "One" });
        await _db.SaveChangesAsync(Ct);

        var query = _db.TestEntities.BatchGetByIds(
            new[] { 1, 2, 3 },
            e => e.Id);

        // Act
        var result = await query.ToD2ResultAsync(_TRACE_ID, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data.Should().NotBeNull();
        result.Data.Should().HaveCount(1);
        result.Data![0].Name.Should().Be("One");
        result.TraceId.Should().Be(_TRACE_ID);
    }

    #endregion

    #region ToD2ResultAsync — Null TraceId

    /// <summary>
    /// Tests that null traceId is accepted.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToD2ResultAsync_NullTraceId_IsAccepted()
    {
        // Arrange
        var query = _db.TestEntities.BatchGetByIds(
            Array.Empty<int>(),
            e => e.Id);

        // Act
        var result = await query.ToD2ResultAsync(traceId: null, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.TraceId.Should().BeNull();
    }

    #endregion

    #region ToDictionaryD2ResultAsync — Empty Input

    /// <summary>
    /// Tests that empty input returns Ok with empty dictionary.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToDictionaryD2ResultAsync_EmptyInput_ReturnsOkWithEmptyDictionary()
    {
        // Arrange
        var query = _db.TestEntities.BatchGetByIds(
            Array.Empty<int>(),
            e => e.Id);

        // Act
        var result = await query.ToDictionaryD2ResultAsync(_TRACE_ID, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data.Should().BeEmpty();
        result.TraceId.Should().Be(_TRACE_ID);
    }

    #endregion

    #region ToDictionaryD2ResultAsync — All Found (Ok)

    /// <summary>
    /// Tests that when all requested IDs are found, dictionary result is Ok.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToDictionaryD2ResultAsync_AllFound_ReturnsOkWithDictionary()
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
        var result = await query.ToDictionaryD2ResultAsync(_TRACE_ID, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().HaveCount(2);
        result.Data![1].Name.Should().Be("One");
        result.Data[2].Name.Should().Be("Two");
        result.TraceId.Should().Be(_TRACE_ID);
    }

    #endregion

    #region ToDictionaryD2ResultAsync — None Found (NotFound)

    /// <summary>
    /// Tests that when no requested IDs are found, dictionary result is NotFound.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToDictionaryD2ResultAsync_NoneFound_ReturnsNotFound()
    {
        // Arrange — no data in DB
        var query = _db.TestEntities.BatchGetByIds(
            new[] { 99, 100 },
            e => e.Id);

        // Act
        var result = await query.ToDictionaryD2ResultAsync(_TRACE_ID, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.NOT_FOUND);
        result.Data.Should().BeNull();
        result.TraceId.Should().Be(_TRACE_ID);
    }

    #endregion

    #region ToDictionaryD2ResultAsync — Partial Success (SomeFound)

    /// <summary>
    /// Tests that when only some requested IDs are found, dictionary result is SomeFound.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ToDictionaryD2ResultAsync_SomeFound_ReturnsSomeFoundWithData()
    {
        // Arrange — only 2 of 3 requested entities exist
        _db.TestEntities.AddRange(
            new TestEntity { Id = 1, Name = "One" },
            new TestEntity { Id = 3, Name = "Three" });
        await _db.SaveChangesAsync(Ct);

        var query = _db.TestEntities.BatchGetByIds(
            new[] { 1, 2, 3 },
            e => e.Id);

        // Act
        var result = await query.ToDictionaryD2ResultAsync(_TRACE_ID, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data.Should().NotBeNull();
        result.Data.Should().HaveCount(2);
        result.Data.Should().ContainKey(1);
        result.Data.Should().ContainKey(3);
        result.Data.Should().NotContainKey(2);
        result.TraceId.Should().Be(_TRACE_ID);
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
    /// A simple test entity for D2ResultExtensions tests.
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
    /// A test DbContext for D2ResultExtensions tests.
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
    }

    #endregion
}
