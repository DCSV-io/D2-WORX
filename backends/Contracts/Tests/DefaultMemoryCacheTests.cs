using D2.Contracts.Interfaces;
using D2.Contracts.MemoryCache.Default;
using D2.Contracts.Handler;
using D2.Contracts.MemoryCache.Default.Handlers;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;

namespace D2.Contracts.Tests;

/// <summary>
/// Tests for <see cref="DefaultMemoryCacheService"/>.
/// </summary>
public class DefaultMemoryCacheTests
{
    private readonly IMemoryCache r_cache
        = new Microsoft.Extensions.Caching.Memory.MemoryCache(new MemoryCacheOptions());
    private readonly IHandlerContext r_context = TestHelpers.CreateHandlerContext();

    [Fact]
    public async Task Get_WhenKeyMissing_ReturnsNotFound()
    {
        var handler = new Get<string>(r_cache, r_context);
        var result = await handler.HandleAsync(
            new ICommonCacheService.GetInput("missing-key"),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_WhenKeyExists_ReturnsValue()
    {
        r_cache.Set("test-key", "test-value");

        var handler = new Get<string>(r_cache, r_context);
        var result = await handler.HandleAsync(
            new ICommonCacheService.GetInput("test-key"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Value.Should().Be("test-value");
    }

    [Fact]
    public async Task Set_WithValidInput_StoresValueInCache()
    {
        var setHandler = new Set<string>(r_cache, r_context);
        var setResult = await setHandler.HandleAsync(
            new ICommonCacheService.SetInput<string>("key", "value", null),
            CancellationToken.None);

        setResult.Success.Should().BeTrue();
        r_cache.TryGetValue<string>("key", out var cached).Should().BeTrue();
        cached.Should().Be("value");
    }

    [Fact]
    public async Task Set_WithExpiration_ExpiresAfterDuration()
    {
        var handler = new Set<string>(r_cache, r_context);
        await handler.HandleAsync(
            new ICommonCacheService.SetInput<string>(
                "key", "value", TimeSpan.FromMilliseconds(100)),
            CancellationToken.None);

        await Task.Delay(200, CancellationToken.None);

        r_cache.TryGetValue<string>("key", out _).Should().BeFalse();
    }

    [Fact]
    public async Task Remove_WithExistingKey_DeletesKeyFromCache()
    {
        r_cache.Set("key", "value");

        var handler = new Remove(r_cache, r_context);
        await handler.HandleAsync(
            new ICommonCacheService.RemoveInput("key"),
            CancellationToken.None);

        r_cache.TryGetValue<string>("key", out _).Should().BeFalse();
    }
}
