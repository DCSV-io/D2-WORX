// -----------------------------------------------------------------------
// <copyright file="RedisDistributedCacheTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Tests;

using D2.Contracts.DistributedCache.Redis.Handlers;
using D2.Contracts.Handler;
using D2.Contracts.Interfaces.CommonCacheService;
using D2.Contracts.Interfaces.DistributedCacheService;
using FluentAssertions;
using JetBrains.Annotations;
using StackExchange.Redis;
using Testcontainers.Redis;

/// <summary>
/// Tests for <see cref="DistributedCache.Redis.RedisDistributedCacheService"/>.
/// </summary>
public class RedisDistributedCacheTests : IAsyncLifetime
{
    private RedisContainer _container = null!;
    private IConnectionMultiplexer _redis = null!;
    private IHandlerContext _context = null!;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _container = new RedisBuilder().Build();
        await _container.StartAsync();

        _redis = await ConnectionMultiplexer.ConnectAsync(
            _container.GetConnectionString());
        _context = TestHelpers.CreateHandlerContext();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        _redis.Dispose();
        await _container.DisposeAsync();
    }

    /// <summary>
    /// Tests that getting a missing key returns NotFound.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WhenKeyMissing_ReturnsNotFound()
    {
        var handler = new Get<string>(_redis, _context);
        var result = await handler.HandleAsync(
            new ICommonCacheService.GetInput("missing-key"),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>
    /// Tests that getting an existing key returns the correct value.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WhenKeyExists_ReturnsValue()
    {
        var setHandler = new Set<string>(_redis, _context);
        await setHandler.HandleAsync(
            new ICommonCacheService.SetInput<string>("test-key", "test-value", null),
            CancellationToken.None);

        var getHandler = new Get<string>(_redis, _context);
        var result = await getHandler.HandleAsync(
            new ICommonCacheService.GetInput("test-key"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Value.Should().Be("test-value");
    }

    /// <summary>
    /// Tests that setting a value stores it in the cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Set_WithValidInput_StoresValueInCache()
    {
        var setHandler = new Set<string>(_redis, _context);
        var setResult = await setHandler.HandleAsync(
            new ICommonCacheService.SetInput<string>("key", "value", null),
            CancellationToken.None);

        setResult.Success.Should().BeTrue();

        var db = _redis.GetDatabase();
        var cached = await db.StringGetAsync("key");
        cached.HasValue.Should().BeTrue();
    }

    /// <summary>
    /// Tests that setting a value with expiration expires after the specified duration.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Set_WithExpiration_ExpiresAfterDuration()
    {
        var handler = new Set<string>(_redis, _context);
        await handler.HandleAsync(
            new ICommonCacheService.SetInput<string>(
                "key", "value", TimeSpan.FromMilliseconds(100)),
            CancellationToken.None);

        await Task.Delay(200, CancellationToken.None);

        var db = _redis.GetDatabase();
        var cached = await db.StringGetAsync("key");
        cached.HasValue.Should().BeFalse();
    }

    /// <summary>
    /// Tests that removing an existing key deletes it from the cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Remove_WithExistingKey_DeletesKeyFromCache()
    {
        var db = _redis.GetDatabase();
        await db.StringSetAsync("key", "value");

        var handler = new Remove(_redis, _context);
        await handler.HandleAsync(
            new ICommonCacheService.RemoveInput("key"),
            CancellationToken.None);

        var cached = await db.StringGetAsync("key");
        cached.HasValue.Should().BeFalse();
    }

    /// <summary>
    /// Tests that checking existence of an existing key returns true.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Exists_WhenKeyExists_ReturnsTrue()
    {
        var db = _redis.GetDatabase();
        await db.StringSetAsync("key", "value");

        var handler = new Exists(_redis, _context);
        var result = await handler.HandleAsync(
            new IDistributedCacheService.ExistsInput("key"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Exists.Should().BeTrue();
    }

    /// <summary>
    /// Tests that checking existence of a missing key returns false.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Exists_WhenKeyMissing_ReturnsFalse()
    {
        var handler = new Exists(_redis, _context);
        var result = await handler.HandleAsync(
            new IDistributedCacheService.ExistsInput("missing-key"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Exists.Should().BeFalse();
    }

    /// <summary>
    /// Tests that setting and getting a complex object serializes and deserializes correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Set_WithComplexObject_SerializesAndDeserializesCorrectly()
    {
        var testObject = new TestData { Id = 42, Name = "Test" };

        var setHandler = new Set<TestData>(_redis, _context);
        await setHandler.HandleAsync(
            new ICommonCacheService.SetInput<TestData>("complex-key", testObject, null),
            CancellationToken.None);

        var getHandler = new Get<TestData>(_redis, _context);
        var result = await getHandler.HandleAsync(
            new ICommonCacheService.GetInput("complex-key"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Value.Should().BeEquivalentTo(testObject);
    }

    /// <summary>
    /// Test data class for complex object caching tests.
    /// </summary>
    private record TestData
    {
        /// <summary>
        /// Gets the identifier.
        /// </summary>
        [UsedImplicitly]
        public int Id { get; init; }

        /// <summary>
        /// Gets the name.
        /// </summary>
        [UsedImplicitly]
        public string Name { get; init; } = string.Empty;
    }
}
