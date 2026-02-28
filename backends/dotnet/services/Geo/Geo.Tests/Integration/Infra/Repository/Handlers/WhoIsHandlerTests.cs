// -----------------------------------------------------------------------
// <copyright file="WhoIsHandlerTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.Infra.Repository.Handlers;

using D2.Geo.App.Interfaces.Repository.Handlers.C;
using D2.Geo.App.Interfaces.Repository.Handlers.R;
using D2.Geo.Domain.Entities;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Infra.Repository.Handlers.C;
using D2.Geo.Infra.Repository.Handlers.R;
using D2.Geo.Tests.Fixtures;
using D2.Shared.Handler;
using D2.Shared.Result;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

/// <summary>
/// Integration tests for WhoIs repository handlers (GetWhoIsByIds, CreateWhoIs).
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(false)]
public class WhoIsHandlerTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="WhoIsHandlerTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public WhoIsHandlerTests(SharedPostgresFixture fixture)
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

    #region CreateWhoIs Tests

    /// <summary>
    /// Tests that CreateWhoIs with empty input returns success with 0 inserted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithEmptyInput_ReturnsSuccessWithZeroInserted()
    {
        // Arrange
        var handler = new CreateWhoIs(_db, _options, _context);
        var input = new ICreate.CreateWhoIsInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Created.Should().Be(0);
    }

    /// <summary>
    /// Tests that CreateWhoIs inserts new WhoIs records.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithNewRecords_InsertsAllRecords()
    {
        // Arrange
        var handler = new CreateWhoIs(_db, _options, _context);
        var suffix = Guid.NewGuid().ToString("N");
        var whoIsRecords = new List<WhoIs>
        {
            WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.1", 2025, 1, $"fp-1-{suffix}"),
            WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.2", 2025, 1, $"fp-2-{suffix}"),
            WhoIs.Create($"10.0.{Random.Shared.Next(1, 255)}.1", 2025, 2, $"fp-3-{suffix}"),
        };
        var input = new ICreate.CreateWhoIsInput(whoIsRecords);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Created.Should().Be(3);

        // Verify created records exist in database
        var hashIds = whoIsRecords.Select(w => w.HashId).ToHashSet();
        var dbRecords = await _db.WhoIsRecords.Where(w => hashIds.Contains(w.HashId)).ToListAsync(Ct);
        dbRecords.Should().HaveCount(3);
    }

    /// <summary>
    /// Tests that CreateWhoIs with duplicate records only inserts unique ones.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithDuplicateRecords_OnlyInsertsUnique()
    {
        // Arrange
        var handler = new CreateWhoIs(_db, _options, _context);
        var uniqueIp = $"192.168.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}";
        var uniqueFp = Guid.NewGuid().ToString("N");

        // Create same WhoIs twice (content-addressable = same hash)
        var whoIs1 = WhoIs.Create(uniqueIp, 2025, 1, uniqueFp);
        var whoIs2 = WhoIs.Create(uniqueIp, 2025, 1, uniqueFp);

        whoIs1.HashId.Should().Be(whoIs2.HashId); // Same content = same hash

        var input = new ICreate.CreateWhoIsInput([whoIs1, whoIs2]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1); // Only one inserted since they're the same

        // Verify the single record exists in database
        var dbRecord = await _db.WhoIsRecords.FirstOrDefaultAsync(w => w.HashId == whoIs1.HashId, Ct);
        dbRecord.Should().NotBeNull();
    }

    /// <summary>
    /// Tests that CreateWhoIs skips already existing records.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateWhoIs_WithExistingRecords_SkipsExisting()
    {
        // Arrange
        var createHandler = new CreateWhoIs(_db, _options, _context);
        var suffix = Guid.NewGuid().ToString("N");

        var existingWhoIs = WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.1", 2025, 1, $"existing-{suffix}");

        // Insert first
        var firstInput = new ICreate.CreateWhoIsInput([existingWhoIs]);
        await createHandler.HandleAsync(firstInput, Ct);

        // Now try to insert same + new
        var newWhoIs = WhoIs.Create($"10.0.{Random.Shared.Next(1, 255)}.1", 2025, 2, $"new-{suffix}");

        var secondInput = new ICreate.CreateWhoIsInput([existingWhoIs, newWhoIs]);

        // Act
        var result = await createHandler.HandleAsync(secondInput, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Created.Should().Be(1); // Only new one inserted

        // Verify both records exist in database
        var hashIds = new[] { existingWhoIs.HashId, newWhoIs.HashId };
        var dbRecords = await _db.WhoIsRecords.Where(
            w => hashIds.AsEnumerable().Contains(w.HashId)).ToListAsync(Ct);
        dbRecords.Should().HaveCount(2);
    }

    #endregion

    #region GetWhoIsByIds Tests

    /// <summary>
    /// Tests that GetWhoIsByIds with empty input returns success with empty dictionary.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithEmptyInput_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = new GetWhoIsByIds(_db, _options, _context);
        var input = new IRead.GetWhoIsByIdInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert - Empty input returns Ok with empty data (not an error).
        result.Success.Should().BeTrue();
        result.ErrorCode.Should().BeNull();
        result.Data.Should().NotBeNull();
        result.Data!.WhoIs.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that GetWhoIsByIds returns all requested WhoIs records.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithExistingIds_ReturnsAllRecords()
    {
        // Arrange - Create WhoIs records first
        var createHandler = new CreateWhoIs(_db, _options, _context);
        var suffix = Guid.NewGuid().ToString("N");
        var whoIsRecords = new List<WhoIs>
        {
            WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.1", 2025, 1, $"fp-1-{suffix}"),
            WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.2", 2025, 1, $"fp-2-{suffix}"),
        };
        await createHandler.HandleAsync(new ICreate.CreateWhoIsInput(whoIsRecords), Ct);

        var getHandler = new GetWhoIsByIds(_db, _options, _context);
        var hashIds = whoIsRecords.Select(w => w.HashId).ToList();
        var input = new IRead.GetWhoIsByIdInput(hashIds);

        // Act
        var result = await getHandler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.ErrorCode.Should().BeNull();
        result.Data.Should().NotBeNull();
        result.Data!.WhoIs.Should().HaveCount(2);
        result.Data.WhoIs.Keys.Should().BeEquivalentTo(hashIds);
    }

    /// <summary>
    /// Tests that GetWhoIsByIds returns partial results when some IDs don't exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithSomeMissingIds_ReturnsSomeFound()
    {
        // Arrange - Create one WhoIs
        var createHandler = new CreateWhoIs(_db, _options, _context);
        var existingWhoIs = WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}", 2025, 1, Guid.NewGuid().ToString("N"));
        await createHandler.HandleAsync(new ICreate.CreateWhoIsInput([existingWhoIs]), Ct);

        var getHandler = new GetWhoIsByIds(_db, _options, _context);
        var nonExistentHashId = "0000000000000000000000000000000000000000000000000000000000000000";
        var input = new IRead.GetWhoIsByIdInput([existingWhoIs.HashId, nonExistentHashId]);

        // Act
        var result = await getHandler.HandleAsync(input, Ct);

        // Assert - SOME_FOUND is a partial success (Success=false but data included).
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data.Should().NotBeNull();
        result.Data!.WhoIs.Should().HaveCount(1);
        result.Data.WhoIs.Should().ContainKey(existingWhoIs.HashId);
    }

    /// <summary>
    /// Tests that GetWhoIsByIds returns NOT_FOUND when no IDs exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithNoExistingIds_ReturnsNotFound()
    {
        // Arrange
        var handler = new GetWhoIsByIds(_db, _options, _context);
        var nonExistentHashIds = new List<string>
        {
            "0000000000000000000000000000000000000000000000000000000000000001",
            "0000000000000000000000000000000000000000000000000000000000000002",
        };
        var input = new IRead.GetWhoIsByIdInput(nonExistentHashIds);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert - NOT_FOUND is a failure (Success=false).
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.NOT_FOUND);
        result.Data.Should().BeNull();
    }

    /// <summary>
    /// Tests that GetWhoIsByIds handles large batches correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithLargeBatch_HandlesBatchingCorrectly()
    {
        // Arrange - Create 150 WhoIs records (more than batch size of 100)
        var createHandler = new CreateWhoIs(_db, _options, _context);
        var suffix = Guid.NewGuid().ToString("N");
        var whoIsRecords = Enumerable.Range(0, 150)
            .Select(i => WhoIs.Create($"10.0.{i / 256}.{i % 256}", 2025, 1, $"fp-{i}-{suffix}"))
            .ToList();
        await createHandler.HandleAsync(new ICreate.CreateWhoIsInput(whoIsRecords), Ct);

        var getHandler = new GetWhoIsByIds(_db, _options, _context);
        var hashIds = whoIsRecords.Select(w => w.HashId).ToList();
        var input = new IRead.GetWhoIsByIdInput(hashIds);

        // Act
        var result = await getHandler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.ErrorCode.Should().BeNull();
        result.Data.Should().NotBeNull();
        result.Data!.WhoIs.Should().HaveCount(150);
    }

    /// <summary>
    /// Tests that GetWhoIsByIds deduplicates duplicate IDs in input.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetWhoIsByIds_WithDuplicateIds_DeduplicatesInput()
    {
        // Arrange - Create one WhoIs
        var createHandler = new CreateWhoIs(_db, _options, _context);
        var whoIs = WhoIs.Create($"192.168.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}", 2025, 1, Guid.NewGuid().ToString("N"));
        await createHandler.HandleAsync(new ICreate.CreateWhoIsInput([whoIs]), Ct);

        var getHandler = new GetWhoIsByIds(_db, _options, _context);

        // Request same ID multiple times
        var input = new IRead.GetWhoIsByIdInput([
            whoIs.HashId,
            whoIs.HashId,
            whoIs.HashId,
        ]);

        // Act
        var result = await getHandler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.WhoIs.Should().HaveCount(1);
    }

    #endregion

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
