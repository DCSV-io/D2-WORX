// -----------------------------------------------------------------------
// <copyright file="RequestEnrichmentMiddlewareTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Middleware.RequestEnrichment;

using D2.Geo.Client.Interfaces.CQRS.Handlers.X;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.RequestEnrichment.Default;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

/// <summary>
/// Unit tests for the <see cref="RequestEnrichmentMiddleware"/>.
/// Tests fail-open behavior when Geo service is unavailable.
/// </summary>
public class RequestEnrichmentMiddlewareTests
{
    private readonly Mock<IComplex.IFindWhoIsHandler> r_whoIsHandlerMock;
    private readonly RequestEnrichmentOptions r_options;
    private readonly Mock<ILogger<RequestEnrichmentMiddleware>> r_loggerMock;
    private bool _nextWasCalled;

    /// <summary>
    /// Initializes a new instance of the <see cref="RequestEnrichmentMiddlewareTests"/> class.
    /// </summary>
    public RequestEnrichmentMiddlewareTests()
    {
        r_whoIsHandlerMock = new Mock<IComplex.IFindWhoIsHandler>();
        r_loggerMock = new Mock<ILogger<RequestEnrichmentMiddleware>>();

        r_options = new RequestEnrichmentOptions
        {
            EnableWhoIsLookup = true,
            ClientFingerprintHeader = "X-Client-Fingerprint",
        };
    }

    #region Basic Enrichment Tests

    /// <summary>
    /// Tests that middleware sets IRequestInfo on HttpContext.Features.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_SetsRequestInfoOnFeatures()
    {
        // Arrange
        var context = CreateHttpContext("203.0.113.1");
        SetupWhoIsReturnsNull();

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo.Should().NotBeNull();
        _nextWasCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that middleware resolves client IP correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_ResolvesClientIp()
    {
        // Arrange
        var context = CreateHttpContext();
        context.Request.Headers["CF-Connecting-IP"] = "198.51.100.50";
        SetupWhoIsReturnsNull();

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo!.ClientIp.Should().Be("198.51.100.50");
    }

    /// <summary>
    /// Tests that middleware computes server fingerprint.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_ComputesServerFingerprint()
    {
        // Arrange
        var context = CreateHttpContext("127.0.0.1");
        context.Request.Headers.UserAgent = "Mozilla/5.0";

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo!.ServerFingerprint.Should().NotBeNullOrEmpty();
        requestInfo.ServerFingerprint.Should().HaveLength(64); // SHA-256 hex
    }

    /// <summary>
    /// Tests that middleware reads client fingerprint header.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_ReadsClientFingerprintHeader()
    {
        // Arrange
        var context = CreateHttpContext("127.0.0.1");
        context.Request.Headers["X-Client-Fingerprint"] = "client-device-fingerprint-abc123";

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo!.ClientFingerprint.Should().Be("client-device-fingerprint-abc123");
    }

    /// <summary>
    /// Tests that middleware handles missing client fingerprint header gracefully.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenNoClientFingerprintHeader_SetsNull()
    {
        // Arrange
        var context = CreateHttpContext("127.0.0.1");

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo!.ClientFingerprint.Should().BeNull();
    }

    #endregion

    #region WhoIs Enrichment Tests

    /// <summary>
    /// Tests that middleware enriches with WhoIs data when available.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenWhoIsReturnsData_EnrichesWithWhoIsFields()
    {
        // Arrange
        var context = CreateHttpContext("203.0.113.1");
        context.Request.Headers.UserAgent = "Mozilla/5.0";
        SetupWhoIsReturnsData("Los Angeles", "US", "US-CA", isVpn: false);

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo!.City.Should().Be("Los Angeles");
        requestInfo.CountryCode.Should().Be("US");
        requestInfo.SubdivisionCode.Should().Be("US-CA");
        requestInfo.IsVpn.Should().BeFalse();
        requestInfo.WhoIsHashId.Should().NotBeNullOrEmpty();
    }

    /// <summary>
    /// Tests that middleware skips WhoIs lookup for localhost.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenLocalhost_SkipsWhoIsLookup()
    {
        // Arrange
        var context = CreateHttpContext("127.0.0.1");

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        r_whoIsHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IComplex.FindWhoIsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);

        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo!.ClientIp.Should().Be("127.0.0.1");
        requestInfo.City.Should().BeNull();
    }

    /// <summary>
    /// Tests that middleware skips WhoIs lookup when disabled in options.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenWhoIsLookupDisabled_SkipsLookup()
    {
        // Arrange
        var context = CreateHttpContext("203.0.113.1");
        var options = new RequestEnrichmentOptions { EnableWhoIsLookup = false };

        var middleware = CreateMiddleware(options);

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        r_whoIsHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IComplex.FindWhoIsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    #endregion

    #region Fail-Open Tests - CRITICAL

    /// <summary>
    /// CRITICAL: Tests that middleware proceeds without WhoIs data when handler returns null.
    /// This ensures the gateway continues working when Geo service returns no data.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenWhoIsReturnsNull_ProceedsWithoutWhoIsData()
    {
        // Arrange
        var context = CreateHttpContext("203.0.113.1");
        SetupWhoIsReturnsNull();

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert - Middleware MUST continue, NOT throw
        _nextWasCalled.Should().BeTrue("middleware must call next even when WhoIs is null");

        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo.Should().NotBeNull("IRequestInfo must be set even without WhoIs");
        requestInfo!.ClientIp.Should().Be("203.0.113.1");
        requestInfo.City.Should().BeNull();
        requestInfo.CountryCode.Should().BeNull();
        requestInfo.WhoIsHashId.Should().BeNull();
    }

    /// <summary>
    /// CRITICAL: Tests that middleware proceeds when WhoIs handler returns failure result.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenWhoIsReturnsFail_ProceedsWithoutWhoIsData()
    {
        // Arrange
        var context = CreateHttpContext("198.51.100.1");
        SetupWhoIsReturnsFailure();

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        _nextWasCalled.Should().BeTrue("middleware must call next even when WhoIs fails");

        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo.Should().NotBeNull();
        requestInfo!.ClientIp.Should().Be("198.51.100.1");
        requestInfo.City.Should().BeNull();
    }

    /// <summary>
    /// CRITICAL: Tests that middleware proceeds when WhoIs handler throws exception.
    /// This is the ultimate fail-open test - even unhandled exceptions should not break the pipeline.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenWhoIsHandlerThrows_ProceedsWithoutWhoIsData()
    {
        // Arrange
        var context = CreateHttpContext("192.0.2.1");
        SetupWhoIsThrows(new InvalidOperationException("Unexpected error in WhoIs handler"));

        var middleware = CreateMiddleware();

        // Act & Assert - Should NOT throw, should proceed
        var act = () => middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        await act.Should().NotThrowAsync();
        _nextWasCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that VPN/Proxy flags are properly set when WhoIs returns them.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenWhoIsIndicatesVpn_SetsVpnFlag()
    {
        // Arrange
        var context = CreateHttpContext("203.0.113.1");
        SetupWhoIsReturnsData("Unknown", "XX", null, isVpn: true, isProxy: true, isTor: false);

        var middleware = CreateMiddleware();

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        var requestInfo = context.Features.Get<IRequestInfo>();
        requestInfo!.IsVpn.Should().BeTrue();
        requestInfo.IsProxy.Should().BeTrue();
        requestInfo.IsTor.Should().BeFalse();
    }

    #endregion

    #region Pipeline Continuation Tests

    /// <summary>
    /// Tests that middleware always calls next, even with minimal data.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_AlwaysCallsNext()
    {
        // Arrange
        var context = CreateHttpContext();
        var options = new RequestEnrichmentOptions { EnableWhoIsLookup = false };

        var middleware = CreateMiddleware(options);

        // Act
        await middleware.InvokeAsync(context, r_whoIsHandlerMock.Object);

        // Assert
        _nextWasCalled.Should().BeTrue();
    }

    #endregion

    #region Helper Methods

    private static DefaultHttpContext CreateHttpContext(string? clientIp = null)
    {
        var context = new DefaultHttpContext();

        if (clientIp is not null)
        {
            context.Request.Headers["CF-Connecting-IP"] = clientIp;
        }

        return context;
    }

    private RequestEnrichmentMiddleware CreateMiddleware(RequestEnrichmentOptions? options = null)
    {
        _nextWasCalled = false;

        return new RequestEnrichmentMiddleware(
            next: _ =>
            {
                _nextWasCalled = true;
                return Task.CompletedTask;
            },
            Options.Create(options ?? r_options),
            r_loggerMock.Object);
    }

    private void SetupWhoIsReturnsNull()
    {
        r_whoIsHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IComplex.FindWhoIsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IComplex.FindWhoIsOutput?>.Ok(
                new IComplex.FindWhoIsOutput(null)));
    }

    private void SetupWhoIsReturnsFailure()
    {
        r_whoIsHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IComplex.FindWhoIsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IComplex.FindWhoIsOutput?>.Fail(["WhoIs lookup failed"]));
    }

    private void SetupWhoIsThrows(Exception exception)
    {
        r_whoIsHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IComplex.FindWhoIsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ThrowsAsync(exception);
    }

    private void SetupWhoIsReturnsData(
        string city,
        string countryCode,
        string? subdivisionCode,
        bool isVpn = false,
        bool isProxy = false,
        bool isTor = false)
    {
        var location = new LocationDTO
        {
            HashId = Guid.NewGuid().ToString(),
            City = city,
            CountryIso31661Alpha2Code = countryCode,
        };

        if (subdivisionCode is not null)
        {
            location.SubdivisionIso31662Code = subdivisionCode;
        }

        var whoIs = new WhoIsDTO
        {
            HashId = Guid.NewGuid().ToString(),
            IpAddress = "203.0.113.1",
            IsVpn = isVpn,
            IsProxy = isProxy,
            IsTor = isTor,
            Location = location,
        };

        r_whoIsHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IComplex.FindWhoIsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IComplex.FindWhoIsOutput?>.Ok(
                new IComplex.FindWhoIsOutput(whoIs)));
    }

    #endregion
}
