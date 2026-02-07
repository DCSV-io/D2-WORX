// -----------------------------------------------------------------------
// <copyright file="CheckHandlerTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Middleware.RateLimit;

using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.R;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.U;
using D2.Shared.RateLimit.Default;
using D2.Shared.RateLimit.Default.Handlers;
using D2.Shared.RateLimit.Default.Interfaces;
using D2.Shared.RequestEnrichment.Default;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;

/// <summary>
/// Unit tests for the <see cref="Check"/> rate limit handler.
/// </summary>
public class CheckHandlerTests
{
    private readonly Mock<IRead.IGetTtlHandler> r_getTtlMock;
    private readonly Mock<IUpdate.IIncrementHandler> r_incrementMock;
    private readonly Mock<IUpdate.ISetHandler<string>> r_setMock;
    private readonly RateLimitOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="CheckHandlerTests"/> class.
    /// </summary>
    public CheckHandlerTests()
    {
        r_getTtlMock = new Mock<IRead.IGetTtlHandler>();
        r_incrementMock = new Mock<IUpdate.IIncrementHandler>();
        r_setMock = new Mock<IUpdate.ISetHandler<string>>();

        r_options = new RateLimitOptions
        {
            ClientFingerprintThreshold = 100,
            IpThreshold = 5000,
            CityThreshold = 25000,
            CountryThreshold = 100000,
            Window = TimeSpan.FromMinutes(1),
            BlockDuration = TimeSpan.FromMinutes(5),
            WhitelistedCountryCodes = ["US", "CA", "GB"],
        };
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Dimension Skip Tests

    /// <summary>
    /// Tests that fingerprint dimension is skipped when ClientFingerprint is null.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenClientFingerprintNull_SkipsFingerprintDimension()
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(clientFingerprint: null, clientIp: "127.0.0.1");

        SetupNotBlocked();

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();
        result.Data!.IsBlocked.Should().BeFalse();

        // Should not have checked fingerprint dimension (no GetTtl call for fingerprint).
        r_getTtlMock.Verify(
            x => x.HandleAsync(
                It.Is<IRead.GetTtlInput>(i => i.Key.Contains("clientfingerprint")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that fingerprint dimension is skipped when ClientFingerprint is empty.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenClientFingerprintEmpty_SkipsFingerprintDimension()
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(clientFingerprint: "   ", clientIp: "127.0.0.1");

        SetupNotBlocked();

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();

        r_getTtlMock.Verify(
            x => x.HandleAsync(
                It.Is<IRead.GetTtlInput>(i => i.Key.Contains("clientfingerprint")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that IP dimension is skipped for localhost addresses.
    /// </summary>
    ///
    /// <param name="localhost">The localhost address to test.</param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("::1")]
    [InlineData("localhost")]
    [InlineData("unknown")]
    public async Task Check_WhenLocalhost_SkipsIpDimension(string localhost)
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(clientIp: localhost);

        SetupNotBlocked();

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();

        r_getTtlMock.Verify(
            x => x.HandleAsync(
                It.Is<IRead.GetTtlInput>(i => i.Key.Contains("blocked:ip:")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that city dimension is skipped when City is null.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenCityNull_SkipsCityDimension()
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(clientIp: "127.0.0.1", city: null);

        SetupNotBlocked();

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();

        r_getTtlMock.Verify(
            x => x.HandleAsync(
                It.Is<IRead.GetTtlInput>(i => i.Key.Contains("blocked:city:")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that country dimension is skipped when CountryCode is null.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenCountryCodeNull_SkipsCountryDimension()
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(clientIp: "127.0.0.1", countryCode: null);

        SetupNotBlocked();

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();

        r_getTtlMock.Verify(
            x => x.HandleAsync(
                It.Is<IRead.GetTtlInput>(i => i.Key.Contains("blocked:country:")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that country dimension is skipped for whitelisted countries.
    /// </summary>
    ///
    /// <param name="countryCode">The whitelisted country code to test.</param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Theory]
    [InlineData("US")]
    [InlineData("CA")]
    [InlineData("GB")]
    public async Task Check_WhenCountryWhitelisted_SkipsCountryDimension(string countryCode)
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(clientIp: "127.0.0.1", countryCode: countryCode);

        SetupNotBlocked();

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();

        r_getTtlMock.Verify(
            x => x.HandleAsync(
                It.Is<IRead.GetTtlInput>(i => i.Key.Contains("blocked:country:")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that country dimension is checked for non-whitelisted countries.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenCountryNotWhitelisted_ChecksCountryDimension()
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(clientIp: "127.0.0.1", countryCode: "DE");

        SetupNotBlocked();

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();

        r_getTtlMock.Verify(
            x => x.HandleAsync(
                It.Is<IRead.GetTtlInput>(i => i.Key.Contains("blocked:country:")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Blocking Tests

    /// <summary>
    /// Tests that Check returns blocked when dimension is already blocked.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenDimensionAlreadyBlocked_ReturnsBlocked()
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(
            clientFingerprint: "test-fingerprint",
            clientIp: "192.0.2.1");

        // Setup fingerprint dimension as already blocked.
        r_getTtlMock
            .Setup(x => x.HandleAsync(
                It.Is<IRead.GetTtlInput>(i => i.Key.Contains("blocked:clientfingerprint:")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetTtlOutput?>.Ok(
                new IRead.GetTtlOutput(TimeSpan.FromMinutes(3))));

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();
        result.Data!.IsBlocked.Should().BeTrue();
        result.Data.BlockedDimension.Should().Be(RateLimitDimension.ClientFingerprint);
        result.Data.RetryAfter.Should().Be(TimeSpan.FromMinutes(3));
    }

    #endregion

    #region Fail-Open Tests

    /// <summary>
    /// Tests that Check allows request when cache is unavailable (fail-open).
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenCacheUnavailable_FailsOpen()
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(clientIp: "192.0.2.1");

        // Setup cache handlers to return failures.
        r_getTtlMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetTtlInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetTtlOutput?>.Fail(["Cache unavailable"]));

        r_incrementMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IUpdate.IncrementInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IUpdate.IncrementOutput?>.Fail(["Cache unavailable"]));

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();
        result.Data!.IsBlocked.Should().BeFalse();
    }

    /// <summary>
    /// Tests that Check allows request when cache operation throws (fail-open per dimension).
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenCacheOperationThrows_FailsOpen()
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(
            clientFingerprint: "test",
            clientIp: "192.0.2.1");

        r_getTtlMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetTtlInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ThrowsAsync(new InvalidOperationException("Cache timeout"));

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();
        result.Data!.IsBlocked.Should().BeFalse();
    }

    #endregion

    #region Helper Methods

    private static IRequestInfo CreateRequestInfo(
        string? clientFingerprint = null,
        string clientIp = "192.0.2.1",
        string? city = null,
        string? countryCode = null)
    {
        var mock = new Mock<IRequestInfo>();
        mock.Setup(x => x.ClientFingerprint).Returns(clientFingerprint);
        mock.Setup(x => x.ClientIp).Returns(clientIp);
        mock.Setup(x => x.City).Returns(city);
        mock.Setup(x => x.CountryCode).Returns(countryCode);
        return mock.Object;
    }

    private Check CreateHandler()
    {
        var options = Options.Create(r_options);
        var context = TestHelpers.CreateHandlerContext();
        return new Check(
            r_getTtlMock.Object,
            r_incrementMock.Object,
            r_setMock.Object,
            options,
            context);
    }

    private void SetupNotBlocked()
    {
        // GetTtl returns null (not blocked).
        r_getTtlMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetTtlInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetTtlOutput?>.Ok(new IRead.GetTtlOutput(null)));

        // Increment returns low count.
        r_incrementMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IUpdate.IncrementInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IUpdate.IncrementOutput?>.Ok(new IUpdate.IncrementOutput(1)));
    }

    #endregion
}
