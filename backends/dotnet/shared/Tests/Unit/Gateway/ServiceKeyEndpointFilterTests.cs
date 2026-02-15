// -----------------------------------------------------------------------
// <copyright file="ServiceKeyEndpointFilterTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Gateway;

using D2.Gateways.REST.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;

/// <summary>
/// Unit tests for the <see cref="ServiceKeyEndpointFilter"/>.
/// </summary>
public class ServiceKeyEndpointFilterTests
{
    private const string _HEADER = "X-Api-Key";
    private const string _VALID_KEY = "d2.sveltekit.service.key";
    private const string _ANOTHER_VALID_KEY = "d2.other.service.key";

    /// <summary>
    /// When a valid API key is present, the request passes through.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithValidKey_PassesThrough()
    {
        var filter = CreateFilter(_VALID_KEY);
        var context = CreateContext(_VALID_KEY);
        var nextCalled = false;

        await filter.InvokeAsync(context, _ =>
        {
            nextCalled = true;
            return ValueTask.FromResult<object?>("ok");
        });

        nextCalled.Should().BeTrue();
    }

    /// <summary>
    /// When the API key header is missing, returns 401.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithMissingKey_Returns401()
    {
        var filter = CreateFilter(_VALID_KEY);
        var context = CreateContext(apiKey: null);

        var result = await filter.InvokeAsync(context, _ =>
            ValueTask.FromResult<object?>("should not reach"));

        result.Should().BeOfType<ProblemHttpResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    /// <summary>
    /// When the API key is invalid, returns 401.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithInvalidKey_Returns401()
    {
        var filter = CreateFilter(_VALID_KEY);
        var context = CreateContext("wrong-key");

        var result = await filter.InvokeAsync(context, _ =>
            ValueTask.FromResult<object?>("should not reach"));

        result.Should().BeOfType<ProblemHttpResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    /// <summary>
    /// When an empty API key is sent, returns 401.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithEmptyKey_Returns401()
    {
        var filter = CreateFilter(_VALID_KEY);
        var context = CreateContext(string.Empty);

        var result = await filter.InvokeAsync(context, _ =>
            ValueTask.FromResult<object?>("should not reach"));

        result.Should().BeOfType<ProblemHttpResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    /// <summary>
    /// Multiple valid keys are accepted — any one of them passes.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithMultipleValidKeys_AcceptsAny()
    {
        var filter = CreateFilter(_VALID_KEY, _ANOTHER_VALID_KEY);
        var context = CreateContext(_ANOTHER_VALID_KEY);
        var nextCalled = false;

        await filter.InvokeAsync(context, _ =>
        {
            nextCalled = true;
            return ValueTask.FromResult<object?>("ok");
        });

        nextCalled.Should().BeTrue();
    }

    /// <summary>
    /// Key comparison is case-sensitive (API keys should be exact match).
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_KeyComparison_IsCaseSensitive()
    {
        var filter = CreateFilter(_VALID_KEY);
        var context = CreateContext(_VALID_KEY.ToUpperInvariant());

        var result = await filter.InvokeAsync(context, _ =>
            ValueTask.FromResult<object?>("should not reach"));

        result.Should().BeOfType<ProblemHttpResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    /// <summary>
    /// When no valid keys are configured, all requests are rejected.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_NoValidKeysConfigured_RejectsAll()
    {
        var filter = CreateFilter();
        var context = CreateContext(_VALID_KEY);

        var result = await filter.InvokeAsync(context, _ =>
            ValueTask.FromResult<object?>("should not reach"));

        result.Should().BeOfType<ProblemHttpResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    #region Helpers

    private static ServiceKeyEndpointFilter CreateFilter(params string[] validKeys)
    {
        var options = Options.Create(new ServiceKeyOptions
        {
            ValidKeys = [.. validKeys],
        });

        return new ServiceKeyEndpointFilter(options);
    }

    private static EndpointFilterInvocationContext CreateContext(string? apiKey)
    {
        var httpContext = new DefaultHttpContext();

        if (apiKey is not null)
        {
            httpContext.Request.Headers[_HEADER] = apiKey;
        }

        return new DefaultEndpointFilterInvocationContext(httpContext);
    }

    #endregion
}
