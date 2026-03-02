// -----------------------------------------------------------------------
// <copyright file="RateLimitRedisTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Integration.Middleware;

using D2.Shared.DistributedCache.Redis;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.R;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.U;
using D2.Shared.RateLimit.Default;
using D2.Shared.RateLimit.Default.Handlers;
using D2.Shared.RateLimit.Default.Interfaces;
using D2.Shared.RequestEnrichment.Default;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Moq;
using StackExchange.Redis;
using Testcontainers.Redis;

/// <summary>
/// Integration tests for the rate limit handler with real Redis.
/// </summary>
[MustDisposeResource(false)]
public class RateLimitRedisTests : IAsyncLifetime
{
    private RedisContainer _container = null!;
    private IConnectionMultiplexer _redis = null!;
    private ServiceProvider _serviceProvider = null!;

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _container = new RedisBuilder("redis:8.2").Build();
        await _container.StartAsync(Ct);
        _redis = await ConnectionMultiplexer.ConnectAsync(_container.GetConnectionString());

        // Set up DI container with distributed cache handlers.
        var services = new ServiceCollection();
        services.AddRedisCaching(_container.GetConnectionString());
        services.AddLogging();

        // Register handler context for distributed cache handlers (they extend BaseHandler).
        var mockRequestContext = new Mock<IRequestContext>();
        mockRequestContext.Setup(x => x.TraceId).Returns(Guid.NewGuid().ToString());
        services.AddSingleton<IRequestContext>(_ => mockRequestContext.Object);
        services.AddScoped<IHandlerContext, HandlerContext>();

        _serviceProvider = services.BuildServiceProvider();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _serviceProvider.DisposeAsync();
        _redis.Dispose();
        await _container.DisposeAsync();
    }

    /// <summary>
    /// Tests that requests under threshold are not blocked.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenUnderThreshold_AllowsRequests()
    {
        var options = CreateOptions(fingerprintThreshold: 10);
        var handler = CreateHandler(options);
        var requestInfo = CreateRequestInfo(clientFingerprint: "test-fp-under");

        // Make 5 requests (under threshold of 10)
        for (var i = 0; i < 5; i++)
        {
            var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
            result.Success.Should().BeTrue();
            result.Data!.IsBlocked.Should().BeFalse();
        }
    }

    /// <summary>
    /// Tests that requests exceeding threshold are blocked.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenThresholdExceeded_BlocksRequests()
    {
        var options = CreateOptions(fingerprintThreshold: 5);
        var handler = CreateHandler(options);
        var requestInfo = CreateRequestInfo(clientFingerprint: "test-fp-exceed");

        // Make requests up to threshold
        for (var i = 0; i < 5; i++)
        {
            var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
            result.Success.Should().BeTrue();
            result.Data!.IsBlocked.Should().BeFalse();
        }

        // Next request should be blocked
        var blockedResult = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
        blockedResult.Success.Should().BeTrue();
        blockedResult.Data!.IsBlocked.Should().BeTrue();
        blockedResult.Data.BlockedDimension.Should().Be(RateLimitDimension.ClientFingerprint);
        blockedResult.Data.RetryAfter.Should().NotBeNull();
    }

    /// <summary>
    /// Tests that blocked dimension stays blocked for subsequent requests.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenAlreadyBlocked_StaysBlocked()
    {
        var options = CreateOptions(fingerprintThreshold: 2, blockDuration: TimeSpan.FromSeconds(30));
        var handler = CreateHandler(options);
        var requestInfo = CreateRequestInfo(clientFingerprint: "test-fp-stay-blocked");

        // Exceed threshold to get blocked
        for (var i = 0; i < 3; i++)
        {
            await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
        }

        // Verify still blocked on subsequent requests
        for (var i = 0; i < 3; i++)
        {
            var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
            result.Data!.IsBlocked.Should().BeTrue();
        }
    }

    /// <summary>
    /// Tests that different fingerprints have separate counters.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_DifferentFingerprints_HaveSeparateCounters()
    {
        var options = CreateOptions(fingerprintThreshold: 3);
        var handler = CreateHandler(options);

        var requestInfo1 = CreateRequestInfo(clientFingerprint: "fingerprint-1");
        var requestInfo2 = CreateRequestInfo(clientFingerprint: "fingerprint-2");

        // Make 3 requests for fingerprint-1 (at threshold)
        for (var i = 0; i < 3; i++)
        {
            await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo1), Ct);
        }

        // fingerprint-2 should still be allowed
        var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo2), Ct);
        result.Data!.IsBlocked.Should().BeFalse();

        // fingerprint-1 next request should be blocked
        var blockedResult = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo1), Ct);
        blockedResult.Data!.IsBlocked.Should().BeTrue();
    }

    /// <summary>
    /// Tests that IP dimension is checked for non-localhost addresses.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WithPublicIp_ChecksIpDimension()
    {
        var options = CreateOptions(ipThreshold: 3);
        var handler = CreateHandler(options);
        var requestInfo = CreateRequestInfo(clientIp: "203.0.113.100");

        // Make requests up to threshold
        for (var i = 0; i < 3; i++)
        {
            var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
            result.Data!.IsBlocked.Should().BeFalse();
        }

        // Next request should be blocked on IP dimension
        var blockedResult = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
        blockedResult.Data!.IsBlocked.Should().BeTrue();
        blockedResult.Data.BlockedDimension.Should().Be(RateLimitDimension.Ip);
    }

    /// <summary>
    /// Tests that city dimension is checked when WhoIs data is present.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WithCity_ChecksCityDimension()
    {
        var options = CreateOptions(cityThreshold: 3);
        var handler = CreateHandler(options);
        var requestInfo = CreateRequestInfo(clientIp: "127.0.0.1", city: "TestCity");

        // Make requests up to threshold
        for (var i = 0; i < 3; i++)
        {
            var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
            result.Data!.IsBlocked.Should().BeFalse();
        }

        // Next request should be blocked on city dimension
        var blockedResult = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
        blockedResult.Data!.IsBlocked.Should().BeTrue();
        blockedResult.Data.BlockedDimension.Should().Be(RateLimitDimension.City);
    }

    /// <summary>
    /// Tests that country dimension is checked for non-whitelisted countries.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WithNonWhitelistedCountry_ChecksCountryDimension()
    {
        var options = CreateOptions(countryThreshold: 3);
        var handler = CreateHandler(options);
        var requestInfo = CreateRequestInfo(clientIp: "127.0.0.1", countryCode: "DE");

        // Make requests up to threshold
        for (var i = 0; i < 3; i++)
        {
            var result = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
            result.Data!.IsBlocked.Should().BeFalse();
        }

        // Next request should be blocked on country dimension
        var blockedResult = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
        blockedResult.Data!.IsBlocked.Should().BeTrue();
        blockedResult.Data.BlockedDimension.Should().Be(RateLimitDimension.Country);
    }

    /// <summary>
    /// Tests that Redis keys have proper TTL set.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_SetsProperKeyTtl()
    {
        var options = CreateOptions(fingerprintThreshold: 100, window: TimeSpan.FromMinutes(1));
        var handler = CreateHandler(options);
        var requestInfo = CreateRequestInfo(clientFingerprint: "test-fp-ttl");

        await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);

        var db = _redis.GetDatabase();
        var keys = _redis.GetServer(_container.GetConnectionString().Split(',')[0])
            .Keys(pattern: "ratelimit:clientfingerprint:test-fp-ttl:*");

        foreach (var key in keys)
        {
            var ttl = await db.KeyTimeToLiveAsync(key);
            ttl.Should().NotBeNull();
            ttl.Value.Should().BeLessThanOrEqualTo(TimeSpan.FromMinutes(2));
            ttl.Value.Should().BeGreaterThan(TimeSpan.Zero);
        }
    }

    /// <summary>
    /// Tests that blocked key has proper TTL matching block duration.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_WhenBlocked_SetsBlockedKeyWithProperTtl()
    {
        var blockDuration = TimeSpan.FromSeconds(30);
        var options = CreateOptions(fingerprintThreshold: 2, blockDuration: blockDuration);
        var handler = CreateHandler(options);
        var requestInfo = CreateRequestInfo(clientFingerprint: "test-fp-block-ttl");

        // Exceed threshold
        for (var i = 0; i < 3; i++)
        {
            await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
        }

        var db = _redis.GetDatabase();
        var blockedKey = "blocked:clientfingerprint:test-fp-block-ttl";
        var ttl = await db.KeyTimeToLiveAsync(blockedKey);

        ttl.Should().NotBeNull();
        ttl.Value.Should().BeLessThanOrEqualTo(blockDuration);
        ttl.Value.Should().BeGreaterThan(TimeSpan.Zero);
    }

    /// <summary>
    /// Tests that block expires after block duration.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Check_BlockExpiresAfterDuration()
    {
        var blockDuration = TimeSpan.FromMilliseconds(500);
        var options = CreateOptions(fingerprintThreshold: 2, blockDuration: blockDuration);
        var handler = CreateHandler(options);
        var requestInfo = CreateRequestInfo(clientFingerprint: "test-fp-expire");

        // Exceed threshold
        for (var i = 0; i < 3; i++)
        {
            await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
        }

        // Verify blocked
        var blockedResult = await handler.HandleAsync(new IRateLimit.CheckInput(requestInfo), Ct);
        blockedResult.Data!.IsBlocked.Should().BeTrue();

        // Wait for block to expire
        await Task.Delay(600, Ct);

        // Should no longer be blocked (though may still hit counter threshold)
        var db = _redis.GetDatabase();
        var blockedKey = "blocked:clientfingerprint:test-fp-expire";
        var exists = await db.KeyExistsAsync(blockedKey);
        exists.Should().BeFalse();
    }

    #region Helper Methods

    private static RateLimitOptions CreateOptions(
        int fingerprintThreshold = 100,
        int ipThreshold = 5000,
        int cityThreshold = 25000,
        int countryThreshold = 100000,
        TimeSpan? window = null,
        TimeSpan? blockDuration = null)
    {
        return new RateLimitOptions
        {
            ClientFingerprintThreshold = fingerprintThreshold,
            IpThreshold = ipThreshold,
            CityThreshold = cityThreshold,
            CountryThreshold = countryThreshold,
            Window = window ?? TimeSpan.FromMinutes(1),
            BlockDuration = blockDuration ?? TimeSpan.FromMinutes(5),
            WhitelistedCountryCodes = ["US", "CA", "GB"],
        };
    }

    private static IRequestInfo CreateRequestInfo(
        string? clientFingerprint = null,
        string clientIp = "127.0.0.1",
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

    private Check CreateHandler(RateLimitOptions options)
    {
        var optionsWrapper = Options.Create(options);
        var context = TestHelpers.CreateHandlerContext();

        // Get handlers from DI container.
        var getTtlHandler = _serviceProvider.GetRequiredService<IRead.IGetTtlHandler>();
        var incrementHandler = _serviceProvider.GetRequiredService<IUpdate.IIncrementHandler>();
        var setHandler = _serviceProvider.GetRequiredService<IUpdate.ISetHandler<string>>();

        return new Check(
            getTtlHandler,
            incrementHandler,
            setHandler,
            optionsWrapper,
            context);
    }

    #endregion
}
