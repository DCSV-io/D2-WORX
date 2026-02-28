// -----------------------------------------------------------------------
// <copyright file="DeleteStaleWhoIsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.Infra.Repository.Handlers;

using D2.Geo.App.Interfaces.Repository.Handlers.D;
using D2.Geo.Domain.Entities;
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
/// Integration tests for <see cref="DeleteStaleWhoIs"/>.
/// Verifies that only WhoIs records older than the cutoff year/month are deleted.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(false)]
public class DeleteStaleWhoIsTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteStaleWhoIsTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public DeleteStaleWhoIsTests(SharedPostgresFixture fixture)
    {
        r_fixture = fixture;
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public ValueTask InitializeAsync()
    {
        _db = r_fixture.CreateDbContext();
        _context = CreateHandlerContext();
        _options = Options.Create(new GeoInfraOptions { RepoBatchSize = 100 });
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
    }

    #region No Stale Records

    /// <summary>
    /// Verifies that when no WhoIs records exist, the handler returns zero deleted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenNoRecordsExist_ReturnsZero()
    {
        var handler = new DeleteStaleWhoIs(_db, _options, _context);
        var input = new IDelete.DeleteStaleWhoIsInput(2025, 6);

        var result = await handler.HandleAsync(input, Ct);

        result.Success.Should().BeTrue();
        result.Data!.RowsAffected.Should().Be(0);
    }

    /// <summary>
    /// Verifies that WhoIs records newer than the cutoff are NOT deleted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenAllRecordsNewer_DeletesNone()
    {
        // Arrange — seed records from 2025-10 and 2025-12
        var suffix = Guid.NewGuid().ToString("N");
        var newer1 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.1.1", 2025, 10, $"fp-new1-{suffix}");
        var newer2 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.1.2", 2025, 12, $"fp-new2-{suffix}");

        _db.WhoIsRecords.AddRange(newer1, newer2);
        await _db.SaveChangesAsync(Ct);

        // Cutoff is 2025-06: anything Year=2025 Month<6 OR Year<2025 is stale.
        var handler = new DeleteStaleWhoIs(_db, _options, _context);
        var input = new IDelete.DeleteStaleWhoIsInput(2025, 6);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.RowsAffected.Should().Be(0);

        // Verify both records still exist
        var hashIds = new[] { newer1.HashId, newer2.HashId };
        var remaining = await _db.WhoIsRecords
            .Where(w => hashIds.Contains(w.HashId))
            .ToListAsync(Ct);
        remaining.Should().HaveCount(2);

        // Cleanup
        _db.WhoIsRecords.RemoveRange(remaining);
        await _db.SaveChangesAsync(Ct);
    }

    #endregion

    #region All Stale Records

    /// <summary>
    /// Verifies that WhoIs records older than the cutoff are all deleted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenAllRecordsStale_DeletesAll()
    {
        // Arrange — seed records from 2024 and early 2025
        var suffix = Guid.NewGuid().ToString("N");
        var stale1 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.2.1", 2024, 6, $"fp-stale1-{suffix}");
        var stale2 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.2.2", 2024, 12, $"fp-stale2-{suffix}");
        var stale3 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.2.3", 2025, 3, $"fp-stale3-{suffix}");

        _db.WhoIsRecords.AddRange(stale1, stale2, stale3);
        await _db.SaveChangesAsync(Ct);

        // Cutoff is 2025-06: anything Year<2025 OR (Year=2025 AND Month<6) is stale.
        var handler = new DeleteStaleWhoIs(_db, _options, _context);
        var input = new IDelete.DeleteStaleWhoIsInput(2025, 6);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.RowsAffected.Should().BeGreaterThanOrEqualTo(3);

        var hashIds = new[] { stale1.HashId, stale2.HashId, stale3.HashId };
        var remaining = await _db.WhoIsRecords
            .Where(w => hashIds.Contains(w.HashId))
            .ToListAsync(Ct);
        remaining.Should().BeEmpty();
    }

    #endregion

    #region Mixed Stale and Fresh Records

    /// <summary>
    /// Verifies that only stale WhoIs records are deleted while fresh ones are preserved.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WithMixedRecords_OnlyDeletesStale()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");

        // Stale: before 2025-06
        var stale1 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.3.1", 2024, 11, $"fp-s1-{suffix}");
        var stale2 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.3.2", 2025, 5, $"fp-s2-{suffix}");

        // Fresh: 2025-06 and later
        var fresh1 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.3.3", 2025, 6, $"fp-f1-{suffix}");
        var fresh2 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.3.4", 2025, 7, $"fp-f2-{suffix}");
        var fresh3 = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.3.5", 2026, 1, $"fp-f3-{suffix}");

        _db.WhoIsRecords.AddRange(stale1, stale2, fresh1, fresh2, fresh3);
        await _db.SaveChangesAsync(Ct);

        // Cutoff is 2025-06
        var handler = new DeleteStaleWhoIs(_db, _options, _context);
        var input = new IDelete.DeleteStaleWhoIsInput(2025, 6);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.RowsAffected.Should().BeGreaterThanOrEqualTo(2);

        // Stale records should be deleted
        var staleHashIds = new[] { stale1.HashId, stale2.HashId };
        var remainingStale = await _db.WhoIsRecords
            .Where(w => staleHashIds.Contains(w.HashId))
            .ToListAsync(Ct);
        remainingStale.Should().BeEmpty();

        // Fresh records should be preserved
        var freshHashIds = new[] { fresh1.HashId, fresh2.HashId, fresh3.HashId };
        var remainingFresh = await _db.WhoIsRecords
            .Where(w => freshHashIds.Contains(w.HashId))
            .ToListAsync(Ct);
        remainingFresh.Should().HaveCount(3);

        // Cleanup
        _db.WhoIsRecords.RemoveRange(remainingFresh);
        await _db.SaveChangesAsync(Ct);
    }

    #endregion

    #region Boundary Conditions

    /// <summary>
    /// Verifies that a record exactly at the cutoff month is NOT deleted (only strictly older).
    /// The cutoff is "Month &lt; cutoffMonth" (strict less-than), so same year/month is preserved.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenRecordExactlyAtCutoff_PreservesIt()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var atCutoff = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.4.1", 2025, 6, $"fp-exact-{suffix}");
        var justBefore = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.4.2", 2025, 5, $"fp-before-{suffix}");

        _db.WhoIsRecords.AddRange(atCutoff, justBefore);
        await _db.SaveChangesAsync(Ct);

        // Cutoff: 2025-06. Records with (Year=2025, Month=6) should NOT be deleted.
        var handler = new DeleteStaleWhoIs(_db, _options, _context);
        var input = new IDelete.DeleteStaleWhoIsInput(2025, 6);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();

        // At-cutoff preserved
        var atCutoffExists = await _db.WhoIsRecords.AnyAsync(w => w.HashId == atCutoff.HashId, Ct);
        atCutoffExists.Should().BeTrue();

        // Just before cutoff deleted
        var justBeforeExists = await _db.WhoIsRecords.AnyAsync(w => w.HashId == justBefore.HashId, Ct);
        justBeforeExists.Should().BeFalse();

        // Cleanup
        _db.WhoIsRecords.Remove(atCutoff);
        await _db.SaveChangesAsync(Ct);
    }

    /// <summary>
    /// Verifies that records from a previous year are always deleted regardless of month.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenRecordFromPreviousYear_AlwaysDeletes()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");

        // December of previous year — even month=12 should be deleted since year < cutoffYear
        var prevYear = WhoIs.Create($"10.{Random.Shared.Next(1, 255)}.5.1", 2024, 12, $"fp-py-{suffix}");

        _db.WhoIsRecords.Add(prevYear);
        await _db.SaveChangesAsync(Ct);

        // Cutoff: 2025-01
        var handler = new DeleteStaleWhoIs(_db, _options, _context);
        var input = new IDelete.DeleteStaleWhoIsInput(2025, 1);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.RowsAffected.Should().BeGreaterThanOrEqualTo(1);

        var exists = await _db.WhoIsRecords.AnyAsync(w => w.HashId == prevYear.HashId, Ct);
        exists.Should().BeFalse();
    }

    #endregion

    #region Batch Boundary

    /// <summary>
    /// Verifies that stale records exceeding batch size are fully deleted across multiple batches.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenStaleRecordsExceedBatchSize_DeletesAllInMultipleBatches()
    {
        // Arrange — small batch size, more stale records than batch
        const int batch_size = 3;
        const int stale_count = 8;
        var suffix = Guid.NewGuid().ToString("N");

        var staleRecords = Enumerable.Range(0, stale_count)
            .Select(i => WhoIs.Create(
                $"10.{i / 256}.{i % 256}.1",
                2024,
                (i % 12) + 1,
                $"fp-batch-{i}-{suffix}"))
            .ToList();

        _db.WhoIsRecords.AddRange(staleRecords);
        await _db.SaveChangesAsync(Ct);

        // Use small batch size
        var smallBatchOptions = Options.Create(new GeoInfraOptions { RepoBatchSize = batch_size });
        var handler = new DeleteStaleWhoIs(_db, smallBatchOptions, _context);
        var input = new IDelete.DeleteStaleWhoIsInput(2025, 6);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.RowsAffected.Should().BeGreaterThanOrEqualTo(stale_count);

        var hashIds = staleRecords.Select(w => w.HashId).ToHashSet();
        var remaining = await _db.WhoIsRecords
            .Where(w => hashIds.Contains(w.HashId))
            .ToListAsync(Ct);
        remaining.Should().BeEmpty();
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
