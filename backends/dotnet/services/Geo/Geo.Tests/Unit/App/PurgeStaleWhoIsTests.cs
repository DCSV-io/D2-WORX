// -----------------------------------------------------------------------
// <copyright file="PurgeStaleWhoIsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.App;

using D2.Geo.App;
using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Shared.Handler;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using CacheLock = D2.Shared.Interfaces.Caching.Distributed.Handlers.C.ICreate;
using CacheUnlock = D2.Shared.Interfaces.Caching.Distributed.Handlers.D.IDelete;
using RepoDelete = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete;

/// <summary>
/// Unit tests for <see cref="PurgeStaleWhoIs"/> job handler.
/// </summary>
public class PurgeStaleWhoIsTests
{
    private readonly Mock<CacheLock.IAcquireLockHandler> _acquireLock = new();
    private readonly Mock<CacheUnlock.IReleaseLockHandler> _releaseLock = new();
    private readonly Mock<RepoDelete.IDeleteStaleWhoIsHandler> _deleteStaleWhoIs = new();
    private readonly GeoAppOptions _options = new() { JobLockTtlSeconds = 300, WhoIsRetentionDays = 180 };
    private readonly IHandlerContext _context;

    /// <summary>
    /// Initializes a new instance of the <see cref="PurgeStaleWhoIsTests"/> class.
    /// Sets up default mock behaviors (lock acquired, lock released, zero deletions).
    /// </summary>
    public PurgeStaleWhoIsTests()
    {
        _context = CreateHandlerContext();

        // Default: lock acquired successfully
        _acquireLock.Setup(x => x.HandleAsync(
                It.IsAny<CacheLock.AcquireLockInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<CacheLock.AcquireLockOutput?>.Ok(
                new CacheLock.AcquireLockOutput(true)));

        // Default: lock released successfully
        _releaseLock.Setup(x => x.HandleAsync(
                It.IsAny<CacheUnlock.ReleaseLockInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<CacheUnlock.ReleaseLockOutput?>.Ok(
                new CacheUnlock.ReleaseLockOutput(true)));

        // Default: delete returns 0
        _deleteStaleWhoIs.Setup(x => x.HandleAsync(
                It.IsAny<RepoDelete.DeleteStaleWhoIsInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<RepoDelete.DeleteStaleWhoIsOutput?>.Ok(
                new RepoDelete.DeleteStaleWhoIsOutput(0)));
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Lock Not Acquired

    /// <summary>
    /// Verifies that when the lock is not acquired, the handler returns OK with LockAcquired=false
    /// and does not invoke the delete handler.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenLockNotAcquired_ReturnsOkWithLockAcquiredFalse()
    {
        // Arrange
        _acquireLock.Setup(x => x.HandleAsync(
                It.IsAny<CacheLock.AcquireLockInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<CacheLock.AcquireLockOutput?>.Ok(
                new CacheLock.AcquireLockOutput(false)));

        var handler = CreateHandler();

        // Act
        var result = await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.LockAcquired.Should().BeFalse();
        result.Data.RowsAffected.Should().Be(0);
        _deleteStaleWhoIs.Verify(
            x => x.HandleAsync(It.IsAny<RepoDelete.DeleteStaleWhoIsInput>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    #endregion

    #region Lock Acquire Fails (Redis Error)

    /// <summary>
    /// Verifies that a failed lock acquisition (e.g., Redis error) returns OK with LockAcquired=false.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenLockAcquireFails_ReturnsOkWithLockAcquiredFalse()
    {
        // Arrange
        _acquireLock.Setup(x => x.HandleAsync(
                It.IsAny<CacheLock.AcquireLockInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<CacheLock.AcquireLockOutput?>.Fail(["Redis connection failed"]));

        var handler = CreateHandler();

        // Act
        var result = await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.LockAcquired.Should().BeFalse();
        result.Data.RowsAffected.Should().Be(0);
    }

    #endregion

    #region Successful Purge

    /// <summary>
    /// Verifies that with no stale WhoIs records, the handler returns zero rows affected.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenLockAcquiredAndNoStaleRecords_ReturnsZeroRows()
    {
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        result.Success.Should().BeTrue();
        result.Data!.LockAcquired.Should().BeTrue();
        result.Data.RowsAffected.Should().Be(0);
    }

    /// <summary>
    /// Verifies that stale WhoIs records are deleted and the row count is returned.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenLockAcquiredAndStaleRecordsExist_ReturnsRowCount()
    {
        // Arrange
        _deleteStaleWhoIs.Setup(x => x.HandleAsync(
                It.IsAny<RepoDelete.DeleteStaleWhoIsInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<RepoDelete.DeleteStaleWhoIsOutput?>.Ok(
                new RepoDelete.DeleteStaleWhoIsOutput(37)));

        var handler = CreateHandler();

        // Act
        var result = await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.LockAcquired.Should().BeTrue();
        result.Data.RowsAffected.Should().Be(37);
    }

    #endregion

    #region Purge Failure

    /// <summary>
    /// Verifies that a failed delete operation propagates the failure result.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenDeleteFails_PropagatesFailure()
    {
        // Arrange
        _deleteStaleWhoIs.Setup(x => x.HandleAsync(
                It.IsAny<RepoDelete.DeleteStaleWhoIsInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<RepoDelete.DeleteStaleWhoIsOutput?>.Fail(["DB error"]));

        var handler = CreateHandler();

        // Act
        var result = await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        // Assert
        result.Success.Should().BeFalse();
    }

    #endregion

    #region Lock Always Released

    /// <summary>
    /// Verifies that the lock is released after a successful purge.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_AfterSuccessfulPurge_ReleasesLock()
    {
        var handler = CreateHandler();

        await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        _releaseLock.Verify(
            x => x.HandleAsync(It.IsAny<CacheUnlock.ReleaseLockInput>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    /// <summary>
    /// Verifies that the lock is released even when the delete handler throws an exception.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenDeleteThrows_StillReleasesLock()
    {
        // Arrange
        _deleteStaleWhoIs.Setup(x => x.HandleAsync(
                It.IsAny<RepoDelete.DeleteStaleWhoIsInput>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Unexpected"));

        var handler = CreateHandler();

        // Act — BaseHandler wraps exceptions so we get a failed result, not an exception
        var result = await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        // Assert
        result.Success.Should().BeFalse();
        _releaseLock.Verify(
            x => x.HandleAsync(It.IsAny<CacheUnlock.ReleaseLockInput>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    /// <summary>
    /// Verifies that the lock is not released when it was never acquired.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenLockNotAcquired_DoesNotReleaseLock()
    {
        // Arrange
        _acquireLock.Setup(x => x.HandleAsync(
                It.IsAny<CacheLock.AcquireLockInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<CacheLock.AcquireLockOutput?>.Ok(
                new CacheLock.AcquireLockOutput(false)));

        var handler = CreateHandler();

        // Act
        await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        // Assert
        _releaseLock.Verify(
            x => x.HandleAsync(It.IsAny<CacheUnlock.ReleaseLockInput>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    #endregion

    #region Options Passed Correctly

    /// <summary>
    /// Verifies that the lock TTL from options is forwarded to the acquire lock handler.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_PassesLockTtlFromOptions()
    {
        var handler = CreateHandler();

        await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        _acquireLock.Verify(
            x => x.HandleAsync(
                It.Is<CacheLock.AcquireLockInput>(i => i.Expiration == TimeSpan.FromSeconds(300)),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    /// <summary>
    /// Verifies that the cutoff year/month computed from WhoIsRetentionDays is forwarded to the repo handler.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_PassesCutoffYearMonthFromRetentionDays()
    {
        var handler = CreateHandler();

        await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        // The cutoff should be approximately 180 days ago — verify year/month are reasonable.
        var expectedCutoff = DateTime.UtcNow.AddDays(-180);
        _deleteStaleWhoIs.Verify(
            x => x.HandleAsync(
                It.Is<RepoDelete.DeleteStaleWhoIsInput>(i =>
                    i.CutoffYear == expectedCutoff.Year && i.CutoffMonth == expectedCutoff.Month),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    #endregion

    #region Duration Tracking

    /// <summary>
    /// Verifies that the handler reports a non-negative duration.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task HandleAsync_ReportsPositiveDuration()
    {
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.PurgeStaleWhoIsInput(),
            Ct);

        result.Data!.DurationMs.Should().BeGreaterThanOrEqualTo(0);
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

    /// <summary>
    /// Creates a new <see cref="PurgeStaleWhoIs"/> handler with the current mocks and options.
    /// </summary>
    ///
    /// <returns>The configured handler instance.</returns>
    private PurgeStaleWhoIs CreateHandler()
    {
        return new PurgeStaleWhoIs(
            _acquireLock.Object,
            _releaseLock.Object,
            _deleteStaleWhoIs.Object,
            Options.Create(_options),
            _context);
    }
}
