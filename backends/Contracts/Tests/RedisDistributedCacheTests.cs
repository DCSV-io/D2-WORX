using Common.Infra.DistributedCache.Redis;
using Common.Infra.DistributedCache.Redis.Handlers;
using D2.Contracts.Common.App;
using FluentAssertions;
using StackExchange.Redis;
using Testcontainers.Redis;
// ReSharper disable UnusedAutoPropertyAccessor.Local

namespace D2.Contracts.Tests;

/// <summary>
/// Tests for <see cref="RedisDistributedCacheService"/>.
/// </summary>
public class RedisDistributedCacheTests : IAsyncLifetime
{
    private RedisContainer _rContainer = null!;
    private IConnectionMultiplexer _redis = null!;
    private IHandlerContext _context = null!;

    public async ValueTask InitializeAsync()
    {
        _rContainer = new RedisBuilder().Build();
        await _rContainer.StartAsync();

        _redis = await ConnectionMultiplexer.ConnectAsync(
            _rContainer.GetConnectionString());
        _context = TestHelpers.CreateHandlerContext();
    }

    public async ValueTask DisposeAsync()
    {
        _redis.Dispose();
        await _rContainer.DisposeAsync();
    }

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

    private record TestData
    {
        public int Id { get; init; }
        public string Name { get; init; } = string.Empty;
    }
}
