// -----------------------------------------------------------------------
// <copyright file="JwtFingerprintMiddlewareTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Gateway;

using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using D2.Gateways.REST.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;

/// <summary>
/// Unit tests for the <see cref="JwtFingerprintMiddleware"/>.
/// </summary>
public class JwtFingerprintMiddlewareTests
{
    private readonly Mock<ILogger<JwtFingerprintMiddleware>> _mockLogger = new();

    /// <summary>
    /// Tests that a matching fingerprint allows the request through.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithMatchingFingerprint_PassesThrough()
    {
        // Arrange
        const string user_agent = "Mozilla/5.0";
        const string accept = "text/html";
        var fingerprint = ComputeExpectedFingerprint(user_agent, accept);

        var context = CreateAuthenticatedContext(user_agent, accept, fingerprint);
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextCalled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// Tests that a mismatched fingerprint returns 401.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithMismatchedFingerprint_Returns401()
    {
        // Arrange
        var context = CreateAuthenticatedContext("Chrome/120", "text/html", "wrong-fingerprint-hash");
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextCalled.Should().BeFalse();
        context.Response.StatusCode.Should().Be(401);
    }

    /// <summary>
    /// Tests that missing fp claim allows passthrough (backwards-compatible).
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithNoFpClaim_PassesThrough()
    {
        // Arrange — authenticated but no fp claim.
        var context = CreateAuthenticatedContext("Chrome/120", "text/html", fpClaim: null);
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that unauthenticated requests pass through (auth middleware handles them).
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithNoAuthentication_PassesThrough()
    {
        // Arrange — no authenticated identity.
        var context = new DefaultHttpContext();
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that fingerprint comparison is case-insensitive.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_FingerprintComparisonIsCaseInsensitive()
    {
        // Arrange
        const string user_agent = "Mozilla/5.0";
        const string accept = "text/html";
        var fingerprint = ComputeExpectedFingerprint(user_agent, accept).ToUpperInvariant();

        var context = CreateAuthenticatedContext(user_agent, accept, fingerprint);
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert — uppercase fp claim should still match lowercase computed.
        nextCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that the 401 response body contains a D2Result error structure.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_OnMismatch_ReturnsD2ResultErrorBody()
    {
        // Arrange
        var context = CreateAuthenticatedContext("Chrome/120", "text/html", "wrong-hash");
        context.Response.Body = new MemoryStream();
        var middleware = CreateMiddleware(_ => Task.CompletedTask);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be(401);
        context.Response.ContentType.Should().Contain("application/json");
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("JWT_FINGERPRINT_MISMATCH");
    }

    /// <summary>
    /// Tests that empty fp claim is treated as "no claim" (backwards-compatible).
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithEmptyFpClaim_PassesThrough()
    {
        // Arrange
        var context = CreateAuthenticatedContext("Chrome/120", "text/html", fpClaim: string.Empty);
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that a short fp claim (less than 8 chars) does not crash the middleware.
    /// The middleware should still return 401 on mismatch without IndexOutOfRangeException.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous test.</returns>
    [Fact]
    public async Task InvokeAsync_WithShortFpClaim_DoesNotCrash()
    {
        // Arrange — fp claim is only 3 chars, which would crash with [..8] slicing.
        var context = CreateAuthenticatedContext("Chrome/120", "text/html", "abc");
        context.Response.Body = new MemoryStream();
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert — should return 401 without throwing.
        nextCalled.Should().BeFalse();
        context.Response.StatusCode.Should().Be(401);
    }

    #region Helpers

    /// <summary>
    /// Creates an HttpContext with authenticated user and optional fp claim.
    /// </summary>
    private static DefaultHttpContext CreateAuthenticatedContext(
        string userAgent,
        string accept,
        string? fpClaim)
    {
        var claims = new List<Claim> { new("sub", Guid.NewGuid().ToString()) };
        if (fpClaim is not null)
        {
            claims.Add(new Claim("fp", fpClaim));
        }

        var identity = new ClaimsIdentity(claims, "Bearer");
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(identity),
        };
        context.Request.Headers.UserAgent = userAgent;
        context.Request.Headers.Accept = accept;

        return context;
    }

    /// <summary>
    /// Computes the expected fingerprint using the same formula as the validator.
    /// </summary>
    private static string ComputeExpectedFingerprint(string userAgent, string accept)
    {
        var input = $"{userAgent}|{accept}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexStringLower(hash);
    }

    /// <summary>
    /// Creates a <see cref="JwtFingerprintMiddleware"/> with the given next delegate.
    /// </summary>
    private JwtFingerprintMiddleware CreateMiddleware(RequestDelegate next)
    {
        return new JwtFingerprintMiddleware(next, _mockLogger.Object);
    }

    #endregion
}
