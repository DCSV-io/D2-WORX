// -----------------------------------------------------------------------
// <copyright file="CheckHandlerTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Middleware.RateLimit;

using D2.Shared.RateLimit.Redis;
using D2.Shared.RateLimit.Redis.Handlers;
using D2.Shared.RateLimit.Redis.Interfaces;
using D2.Shared.RequestEnrichment;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;
using StackExchange.Redis;

/// <summary>
/// Unit tests for the <see cref="Check"/> rate limit handler.
/// </summary>
public class CheckHandlerTests
{
    private readonly Mock<IConnectionMultiplexer> r_redisMock;
    private readonly Mock<IDatabase> r_dbMock;
    private readonly RateLimitOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="CheckHandlerTests"/> class.
    /// </summary>
    public CheckHandlerTests()
    {
        r_redisMock = new Mock<IConnectionMultiplexer>();
        r_dbMock = new Mock<IDatabase>();
        r_redisMock.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object?>()))
            .Returns(r_dbMock.Object);

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

        // Should not have checked fingerprint dimension (no KeyTimeToLive call for fingerprint)
        r_dbMock.Verify(
            x => x.KeyTimeToLiveAsync(
                It.Is<RedisKey>(k => k.ToString().Contains("clientfingerprint")),
                It.IsAny<CommandFlags>()),
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

        r_dbMock.Verify(
            x => x.KeyTimeToLiveAsync(
                It.Is<RedisKey>(k => k.ToString().Contains("clientfingerprint")),
                It.IsAny<CommandFlags>()),
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

        r_dbMock.Verify(
            x => x.KeyTimeToLiveAsync(
                It.Is<RedisKey>(k => k.ToString().Contains("blocked:ip:")),
                It.IsAny<CommandFlags>()),
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

        r_dbMock.Verify(
            x => x.KeyTimeToLiveAsync(
                It.Is<RedisKey>(k => k.ToString().Contains("blocked:city:")),
                It.IsAny<CommandFlags>()),
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

        r_dbMock.Verify(
            x => x.KeyTimeToLiveAsync(
                It.Is<RedisKey>(k => k.ToString().Contains("blocked:country:")),
                It.IsAny<CommandFlags>()),
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

        r_dbMock.Verify(
            x => x.KeyTimeToLiveAsync(
                It.Is<RedisKey>(k => k.ToString().Contains("blocked:country:")),
                It.IsAny<CommandFlags>()),
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
        SetupBatchOperations();

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();

        r_dbMock.Verify(
            x => x.KeyTimeToLiveAsync(
                It.Is<RedisKey>(k => k.ToString().Contains("blocked:country:")),
                It.IsAny<CommandFlags>()),
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

        // Setup fingerprint dimension as already blocked
        r_dbMock.Setup(x => x.KeyTimeToLiveAsync(
                It.Is<RedisKey>(k => k.ToString().Contains("blocked:clientfingerprint:")),
                It.IsAny<CommandFlags>()))
            .ReturnsAsync(TimeSpan.FromMinutes(3));

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();
        result.Data!.IsBlocked.Should().BeTrue();
        result.Data.BlockedDimension.Should().Be(RateLimitDimension.ClientFingerprint);
        result.Data.RetryAfter.Should().Be(TimeSpan.FromMinutes(3));
    }

    #endregion

    #region Fail-Open Tests

    /// <summary>
    /// Tests that Check allows request when Redis is unavailable (fail-open).
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenRedisUnavailable_FailsOpen()
    {
        r_redisMock.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object?>()))
            .Throws(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "Connection failed"));

        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(clientIp: "192.0.2.1");

        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        result.Success.Should().BeTrue();
        result.Data!.IsBlocked.Should().BeFalse();
    }

    /// <summary>
    /// Tests that Check allows request when Redis operation throws (fail-open per dimension).
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenRedisOperationThrows_FailsOpen()
    {
        var handler = CreateHandler();
        var requestInfo = CreateRequestInfo(
            clientFingerprint: "test",
            clientIp: "192.0.2.1");

        r_dbMock.Setup(x => x.KeyTimeToLiveAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<CommandFlags>()))
            .ThrowsAsync(new RedisTimeoutException("Timeout", CommandStatus.Unknown));

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
        return new Check(r_redisMock.Object, options, context);
    }

    private void SetupNotBlocked()
    {
        r_dbMock.Setup(x => x.KeyTimeToLiveAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<CommandFlags>()))
            .ReturnsAsync((TimeSpan?)null);
    }

    private void SetupBatchOperations()
    {
        var batchMock = new Mock<IBatch>();
        r_dbMock.Setup(x => x.CreateBatch(It.IsAny<object?>()))
            .Returns(batchMock.Object);

        batchMock.Setup(x => x.StringGetAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<CommandFlags>()))
            .Returns(Task.FromResult(RedisValue.Null));

        batchMock.Setup(x => x.StringIncrementAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<long>(),
                It.IsAny<CommandFlags>()))
            .Returns(Task.FromResult(1L));

        batchMock.Setup(x => x.KeyExpireAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<TimeSpan?>(),
                It.IsAny<ExpireWhen>(),
                It.IsAny<CommandFlags>()))
            .Returns(Task.FromResult(true));
    }

    #endregion
}
