// -----------------------------------------------------------------------
// <copyright file="DefaultMemoryCacheTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

// ReSharper disable AccessToStaticMemberViaDerivedType
namespace D2.Contracts.Tests.Unit;

using D2.Contracts.Handler;
using D2.Contracts.InMemoryCache.Default.Handlers.D;
using D2.Contracts.InMemoryCache.Default.Handlers.R;
using D2.Contracts.InMemoryCache.Default.Handlers.U;
using D2.Contracts.Interfaces.Caching.InMemory.Handlers.D;
using D2.Contracts.Interfaces.Caching.InMemory.Handlers.R;
using D2.Contracts.Interfaces.Caching.InMemory.Handlers.U;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;

/// <summary>
/// Tests for the default in-memory cache handlers.
/// </summary>
public class DefaultMemoryCacheTests
{
    private readonly IMemoryCache r_cache
        = new Microsoft.Extensions.Caching.Memory.MemoryCache(new MemoryCacheOptions());

    private readonly IHandlerContext r_context = TestHelpers.CreateHandlerContext();

    /// <summary>
    /// Tests that Get returns a NotFound result when the requested key does not exist in the cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Get_WhenKeyMissing_ReturnsNotFound()
    {
        var handler = new Get<string>(r_cache, r_context);
        var result = await handler.HandleAsync(
            new IRead.GetInput("missing-key"),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>
    /// Tests that Get returns the cached value when the requested key exists in the cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Get_WhenKeyExists_ReturnsValue()
    {
        r_cache.Set("test-key", "test-value");

        var handler = new Get<string>(r_cache, r_context);
        var result = await handler.HandleAsync(
            new IRead.GetInput("test-key"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Value.Should().Be("test-value");
    }

    /// <summary>
    /// Tests that Set successfully stores a value in the cache with valid input.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Set_WithValidInput_StoresValueInCache()
    {
        var setHandler = new Set<string>(r_cache, r_context);
        var setResult = await setHandler.HandleAsync(
            new IUpdate.SetInput<string>("key", "value", null),
            CancellationToken.None);

        setResult.Success.Should().BeTrue();
        r_cache.TryGetValue<string>("key", out var cached).Should().BeTrue();
        cached.Should().Be("value");
    }

    /// <summary>
    /// Tests that Set with an expiration time removes the value from cache after the specified duration.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Set_WithExpiration_ExpiresAfterDuration()
    {
        var handler = new Set<string>(r_cache, r_context);
        await handler.HandleAsync(
            new IUpdate.SetInput<string>(
                "key", "value", TimeSpan.FromMilliseconds(100)),
            CancellationToken.None);

        await Task.Delay(200, CancellationToken.None);

        r_cache.TryGetValue<string>("key", out _).Should().BeFalse();
    }

    /// <summary>
    /// Tests that Remove successfully deletes an existing key from the cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task Remove_WithExistingKey_DeletesKeyFromCache()
    {
        r_cache.Set("key", "value");

        var handler = new Remove(r_cache, r_context);
        await handler.HandleAsync(
            new IDelete.RemoveInput("key"),
            CancellationToken.None);

        r_cache.TryGetValue<string>("key", out _).Should().BeFalse();
    }
}
