// -----------------------------------------------------------------------
// <copyright file="RateLimitMiddlewareTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Middleware.RateLimit;

using D2.Shared.Handler;
using D2.Shared.RateLimit.Redis;
using D2.Shared.RateLimit.Redis.Interfaces;
using D2.Shared.RequestEnrichment;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;

/// <summary>
/// Unit tests for the <see cref="RateLimitMiddleware"/>.
/// Tests fail-open behavior when rate limiting infrastructure is unavailable.
/// </summary>
public class RateLimitMiddlewareTests
{
    private readonly Mock<IRateLimit.ICheckHandler> r_checkHandlerMock;
    private readonly Mock<ILogger<RateLimitMiddleware>> r_loggerMock;
    private bool _nextWasCalled;

    /// <summary>
    /// Initializes a new instance of the <see cref="RateLimitMiddlewareTests"/> class.
    /// </summary>
    public RateLimitMiddlewareTests()
    {
        r_checkHandlerMock = new Mock<IRateLimit.ICheckHandler>();
        r_loggerMock = new Mock<ILogger<RateLimitMiddleware>>();
    }

    #region Pass-Through Tests

    /// <summary>
    /// Tests that middleware passes through when request is allowed.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenRequestAllowed_CallsNext()
    {
        // Arrange
        var context = CreateHttpContextWithRequestInfo();
        SetupCheckReturnsAllowed();

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        _nextWasCalled.Should().BeTrue();
        context.Response.StatusCode.Should().NotBe(429);
    }

    /// <summary>
    /// Tests that middleware uses IRequestInfo from Features.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_ReadsRequestInfoFromFeatures()
    {
        // Arrange
        var requestInfo = CreateRequestInfo("10.0.0.1", "test-fingerprint");
        var context = CreateHttpContext();
        context.Features.Set<IRequestInfo>(requestInfo);
        SetupCheckReturnsAllowed();

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        r_checkHandlerMock.Verify(
            x => x.HandleAsync(
                It.Is<IRateLimit.CheckInput>(i => i.RequestInfo.ClientIp == "10.0.0.1"),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Blocking Tests

    /// <summary>
    /// Tests that middleware returns 429 when request is blocked.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenRequestBlocked_Returns429()
    {
        // Arrange
        var context = CreateHttpContextWithRequestInfo();
        SetupCheckReturnsBlocked(RateLimitDimension.ClientFingerprint, TimeSpan.FromMinutes(5));

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        context.Response.StatusCode.Should().Be(429);
        _nextWasCalled.Should().BeFalse("blocked requests should not call next");
    }

    /// <summary>
    /// Tests that middleware sets Retry-After header when blocked.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenBlocked_SetsRetryAfterHeader()
    {
        // Arrange
        var context = CreateHttpContextWithRequestInfo();
        SetupCheckReturnsBlocked(RateLimitDimension.Ip, TimeSpan.FromSeconds(180));

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        context.Response.Headers.RetryAfter.ToString().Should().Be("180");
    }

    /// <summary>
    /// Tests that middleware returns correct JSON response body when blocked.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenBlocked_ReturnsD2ResultJsonBody()
    {
        // Arrange
        var context = CreateHttpContextWithRequestInfo();
        context.Response.Body = new MemoryStream();
        SetupCheckReturnsBlocked(RateLimitDimension.City, TimeSpan.FromMinutes(5));

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);

        body.Should().Contain("RATE_LIMITED");
        body.Should().Contain("Rate limit exceeded on City dimension");
        context.Response.ContentType.Should().StartWith("application/json");
    }

    /// <summary>
    /// Tests that middleware uses default Retry-After when not provided.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenBlockedWithNullRetryAfter_UsesDefault300Seconds()
    {
        // Arrange
        var context = CreateHttpContextWithRequestInfo();
        SetupCheckReturnsBlocked(RateLimitDimension.Country, retryAfter: null);

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        context.Response.Headers.RetryAfter.ToString().Should().Be("300");
    }

    #endregion

    #region Fail-Open Tests - CRITICAL

    /// <summary>
    /// CRITICAL: Tests that middleware allows request when IRequestInfo is missing.
    /// This ensures the gateway continues working if RequestEnrichmentMiddleware didn't run.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenNoRequestInfo_FailsOpenAndAllowsRequest()
    {
        // Arrange
        var context = CreateHttpContext();

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        _nextWasCalled.Should().BeTrue("missing IRequestInfo should fail-open");
        context.Response.StatusCode.Should().NotBe(429);

        r_checkHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IRateLimit.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// CRITICAL: Tests that middleware allows request when check handler throws.
    /// This ensures the gateway continues working if Redis is unavailable.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenCheckHandlerThrows_FailsOpenAndAllowsRequest()
    {
        // Arrange
        var context = CreateHttpContextWithRequestInfo();
        SetupCheckThrows(new InvalidOperationException("Redis connection failed"));

        var middleware = CreateMiddleware();

        // Act & Assert - Should NOT throw
        var act = () => middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        await act.Should().NotThrowAsync();
        _nextWasCalled.Should().BeTrue("handler exception should fail-open");
        context.Response.StatusCode.Should().NotBe(429);
    }

    /// <summary>
    /// CRITICAL: Tests that middleware allows request when check handler returns failure.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenCheckHandlerReturnsFail_FailsOpenAndAllowsRequest()
    {
        // Arrange
        var context = CreateHttpContextWithRequestInfo();
        SetupCheckReturnsFailure();

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        _nextWasCalled.Should().BeTrue("handler failure should fail-open");
        context.Response.StatusCode.Should().NotBe(429);
    }

    /// <summary>
    /// CRITICAL: Tests that middleware allows request when check returns null output.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenCheckReturnsNullOutput_FailsOpenAndAllowsRequest()
    {
        // Arrange
        var context = CreateHttpContextWithRequestInfo();
        SetupCheckReturnsNullOutput();

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        _nextWasCalled.Should().BeTrue("null output should fail-open");
        context.Response.StatusCode.Should().NotBe(429);
    }

    #endregion

    #region Dimension-Specific Blocking Tests

    /// <summary>
    /// Tests blocking message for each rate limit dimension.
    /// </summary>
    ///
    /// <param name="dimension">The dimension that caused the block.</param>
    /// <param name="expectedMessage">Expected message in response.</param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Theory]
    [InlineData(RateLimitDimension.ClientFingerprint, "ClientFingerprint")]
    [InlineData(RateLimitDimension.Ip, "Ip")]
    [InlineData(RateLimitDimension.City, "City")]
    [InlineData(RateLimitDimension.Country, "Country")]
    public async Task InvokeAsync_WhenBlockedByDimension_IncludesDimensionInMessage(
        RateLimitDimension dimension,
        string expectedMessage)
    {
        // Arrange
        var context = CreateHttpContextWithRequestInfo();
        context.Response.Body = new MemoryStream();
        SetupCheckReturnsBlocked(dimension, TimeSpan.FromMinutes(5));

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_checkHandlerMock.Object);

        // Assert
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);

        body.Should().Contain(expectedMessage);
    }

    #endregion

    #region Helper Methods

    private static DefaultHttpContext CreateHttpContext()
    {
        return new DefaultHttpContext();
    }

    private static DefaultHttpContext CreateHttpContextWithRequestInfo()
    {
        var context = CreateHttpContext();
        context.Features.Set<IRequestInfo>(CreateRequestInfo("192.0.2.1", "test-fingerprint"));
        return context;
    }

    private static IRequestInfo CreateRequestInfo(string clientIp, string? clientFingerprint)
    {
        var mock = new Mock<IRequestInfo>();
        mock.Setup(x => x.ClientIp).Returns(clientIp);
        mock.Setup(x => x.ClientFingerprint).Returns(clientFingerprint);
        mock.Setup(x => x.ServerFingerprint).Returns("server-fp-hash");
        return mock.Object;
    }

    private RateLimitMiddleware CreateMiddleware()
    {
        _nextWasCalled = false;

        return new RateLimitMiddleware(
            next: _ =>
            {
                _nextWasCalled = true;
                return Task.CompletedTask;
            },
            r_loggerMock.Object);
    }

    private void SetupCheckReturnsAllowed()
    {
        r_checkHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRateLimit.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRateLimit.CheckOutput?>.Ok(
                new IRateLimit.CheckOutput(
                    IsBlocked: false,
                    BlockedDimension: null,
                    RetryAfter: null)));
    }

    private void SetupCheckReturnsBlocked(RateLimitDimension dimension, TimeSpan? retryAfter)
    {
        r_checkHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRateLimit.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRateLimit.CheckOutput?>.Ok(
                new IRateLimit.CheckOutput(
                    IsBlocked: true,
                    BlockedDimension: dimension,
                    RetryAfter: retryAfter)));
    }

    private void SetupCheckReturnsFailure()
    {
        r_checkHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRateLimit.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRateLimit.CheckOutput?>.Fail(["Redis error"]));
    }

    private void SetupCheckReturnsNullOutput()
    {
        r_checkHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRateLimit.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRateLimit.CheckOutput?>.Ok(null));
    }

    private void SetupCheckThrows(Exception exception)
    {
        r_checkHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRateLimit.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ThrowsAsync(exception);
    }

    #endregion
}
