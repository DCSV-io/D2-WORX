// -----------------------------------------------------------------------
// <copyright file="IdempotencyMiddlewareTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Middleware.Idempotency;

using D2.Shared.Handler;
using D2.Shared.Idempotency.Default;
using D2.Shared.Idempotency.Default.Interfaces;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.D;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.U;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

/// <summary>
/// Unit tests for the <see cref="IdempotencyMiddleware"/>.
/// </summary>
public class IdempotencyMiddlewareTests
{
    private readonly Mock<IIdempotency.ICheckHandler> r_checkHandlerMock;
    private readonly Mock<IUpdate.ISetHandler<string>> r_setHandlerMock;
    private readonly Mock<IDelete.IRemoveHandler> r_removeHandlerMock;
    private readonly Mock<ILogger<IdempotencyMiddleware>> r_loggerMock;
    private bool _nextWasCalled;
    private int _nextStatusCode = 200;
    private string? _nextBody;

    /// <summary>
    /// Initializes a new instance of the <see cref="IdempotencyMiddlewareTests"/> class.
    /// </summary>
    public IdempotencyMiddlewareTests()
    {
        r_checkHandlerMock = new Mock<IIdempotency.ICheckHandler>();
        r_setHandlerMock = new Mock<IUpdate.ISetHandler<string>>();
        r_removeHandlerMock = new Mock<IDelete.IRemoveHandler>();
        r_loggerMock = new Mock<ILogger<IdempotencyMiddleware>>();

        r_setHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IUpdate.SetOutput?>.Ok(new IUpdate.SetOutput()));

        r_removeHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IDelete.RemoveOutput?>.Ok(new IDelete.RemoveOutput()));
    }

    #region Skip Tests

    /// <summary>
    /// Tests that middleware skips GET requests.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenGetRequest_SkipsAndCallsNext()
    {
        var context = CreateHttpContext("GET");
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        _nextWasCalled.Should().BeTrue();
        r_checkHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IIdempotency.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that middleware skips HEAD requests.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenHeadRequest_SkipsAndCallsNext()
    {
        var context = CreateHttpContext("HEAD");
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        _nextWasCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that middleware skips OPTIONS requests.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenOptionsRequest_SkipsAndCallsNext()
    {
        var context = CreateHttpContext("OPTIONS");
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        _nextWasCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that middleware skips when no Idempotency-Key header is present.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenNoHeader_SkipsAndCallsNext()
    {
        var context = CreateHttpContext("POST");
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        _nextWasCalled.Should().BeTrue();
        r_checkHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IIdempotency.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that middleware processes PUT requests.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenPutRequest_ProcessesIdempotency()
    {
        _nextBody = """{"updated":true}""";
        _nextStatusCode = 200;
        var context = CreateHttpContext("PUT");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        _nextWasCalled.Should().BeTrue();
        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that middleware processes PATCH requests.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenPatchRequest_ProcessesIdempotency()
    {
        _nextStatusCode = 200;
        var context = CreateHttpContext("PATCH");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        _nextWasCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that middleware processes DELETE requests.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenDeleteRequest_ProcessesIdempotency()
    {
        _nextStatusCode = 200;
        var context = CreateHttpContext("DELETE");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        _nextWasCalled.Should().BeTrue();
    }

    /// <summary>
    /// Tests that middleware skips when header is empty/whitespace.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenEmptyHeader_SkipsAndCallsNext()
    {
        var context = CreateHttpContext("POST");
        context.Request.Headers["Idempotency-Key"] = "   ";
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        _nextWasCalled.Should().BeTrue();
        r_checkHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IIdempotency.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    #endregion

    #region Validation Tests

    /// <summary>
    /// Tests that middleware returns 400 for invalid (non-UUID) idempotency key.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenInvalidKey_Returns400()
    {
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = "not-a-uuid";
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        context.Response.StatusCode.Should().Be(400);
        _nextWasCalled.Should().BeFalse();

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("VALIDATION_FAILED");
    }

    /// <summary>
    /// Tests that multiple Idempotency-Key header values are rejected as invalid UUID.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenMultipleHeaderValues_Returns400()
    {
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();

        // Multiple header values get comma-joined which is not a valid UUID.
        context.Request.Headers.Append("Idempotency-Key", Guid.NewGuid().ToString());
        context.Request.Headers.Append("Idempotency-Key", Guid.NewGuid().ToString());
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        context.Response.StatusCode.Should().Be(400);
        _nextWasCalled.Should().BeFalse();
    }

    #endregion

    #region Acquired Tests

    /// <summary>
    /// Tests that middleware executes downstream and caches 2xx response.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenAcquired_ExecutesAndCaches()
    {
        _nextBody = """{"id":"123"}""";
        _nextStatusCode = 201;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        _nextWasCalled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(201);

        // Verify response was written to output
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("123");

        // Verify SET was called to cache the response
        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.Is<IUpdate.SetInput<string>>(i => i.Key.StartsWith("idempotency:")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region InFlight Tests

    /// <summary>
    /// Tests that middleware returns 409 when request is in-flight.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenInFlight_Returns409()
    {
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.InFlight);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        context.Response.StatusCode.Should().Be(409);
        _nextWasCalled.Should().BeFalse();

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("IDEMPOTENCY_IN_FLIGHT");
    }

    #endregion

    #region Cached Tests

    /// <summary>
    /// Tests that middleware replays cached response.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenCached_ReplaysResponse()
    {
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturnsCached(201, """{"id":"123"}""", "application/json");
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        context.Response.StatusCode.Should().Be(201);
        context.Response.ContentType.Should().Be("application/json");
        _nextWasCalled.Should().BeFalse("cached responses should not call next");

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        body.Should().Be("""{"id":"123"}""");
    }

    /// <summary>
    /// Tests that cached response with null body replays correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenCachedWithNullBody_ReplaysWithoutBody()
    {
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturnsCached(204, null, null);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        context.Response.StatusCode.Should().Be(204);
        _nextWasCalled.Should().BeFalse();

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        context.Response.Body.Length.Should().Be(0, "null body should produce empty response");
    }

    /// <summary>
    /// Tests that cached response with empty string body replays correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenCachedWithEmptyBody_ReplaysEmptyBody()
    {
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturnsCached(200, string.Empty, "application/json");
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        context.Response.StatusCode.Should().Be(200);
        context.Response.ContentType.Should().Be("application/json");
        _nextWasCalled.Should().BeFalse();

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        body.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that cached state with null CachedResponse falls through safely.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenCachedStateButNullResponse_ExecutesRequestSafely()
    {
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();

        // State is Cached but CachedResponse is null — shouldn't happen, but defensive.
        r_checkHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IIdempotency.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IIdempotency.CheckOutput?>.Ok(
                new IIdempotency.CheckOutput(IdempotencyState.Cached, null)));

        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        // Should fall through to Acquired path (execute request).
        _nextWasCalled.Should().BeTrue("cached state with null response should execute request");
    }

    #endregion

    #region Fail-Open Tests

    /// <summary>
    /// Tests that middleware allows request when check handler throws.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenCheckThrows_FailsOpen()
    {
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckThrows(new InvalidOperationException("Redis down"));
        var middleware = CreateMiddleware();

        var act = () => middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        await act.Should().NotThrowAsync();
        _nextWasCalled.Should().BeTrue("check failure should fail-open");
    }

    /// <summary>
    /// Tests that middleware allows request when store fails after response.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenStoreFails_ResponseStillSent()
    {
        _nextBody = """{"ok":true}""";
        _nextStatusCode = 200;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);

        r_setHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ThrowsAsync(new InvalidOperationException("Redis write failed"));

        var middleware = CreateMiddleware();

        var act = () => middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        await act.Should().NotThrowAsync();

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("ok");
    }

    #endregion

    #region Error Response Tests

    /// <summary>
    /// Tests that non-2xx responses are not cached and sentinel is removed.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenErrorResponse_RemovesSentinelAndDoesNotCache()
    {
        _nextBody = """{"error":"not found"}""";
        _nextStatusCode = 404;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        // Verify SET was NOT called
        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);

        // Verify REMOVE was called
        r_removeHandlerMock.Verify(
            x => x.HandleAsync(
                It.Is<IDelete.RemoveInput>(i => i.Key.StartsWith("idempotency:")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that large responses are not cached and sentinel is removed.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenLargeBody_RemovesSentinelAndDoesNotCache()
    {
        _nextBody = new string('x', 2_000_000); // 2MB > 1MB default
        _nextStatusCode = 200;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        // Verify SET was NOT called
        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);

        // Verify REMOVE was called
        r_removeHandlerMock.Verify(
            x => x.HandleAsync(
                It.Is<IDelete.RemoveInput>(i => i.Key.StartsWith("idempotency:")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that 4xx response IS cached when CacheErrorResponses is true.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenCacheErrorResponsesTrue_CachesErrorResponse()
    {
        _nextBody = """{"error":"not found"}""";
        _nextStatusCode = 404;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware(new IdempotencyOptions { CacheErrorResponses = true });

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        // SET should be called (error response cached).
        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);

        // REMOVE should NOT be called (response was cached, not cleaned up).
        r_removeHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that body exactly at MaxBodySizeBytes is cached.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenBodyExactlyAtMaxSize_CachesResponse()
    {
        var options = new IdempotencyOptions { MaxBodySizeBytes = 10 };
        _nextBody = new string('a', 10); // Exactly 10 ASCII bytes.
        _nextStatusCode = 200;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware(options);

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        // Should be cached (10 <= 10).
        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that body one byte over MaxBodySizeBytes is NOT cached.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenBodyOneBytOverMax_RemovesSentinel()
    {
        var options = new IdempotencyOptions { MaxBodySizeBytes = 10 };
        _nextBody = new string('a', 11); // 11 ASCII bytes > 10.
        _nextStatusCode = 200;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware(options);

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);

        r_removeHandlerMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Serialization Round-Trip Tests

    /// <summary>
    /// Tests that special characters in body survive the serialization round-trip.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenBodyContainsSpecialChars_SerializesAndCachesCorrectly()
    {
        _nextBody = """{"name":"O'Brien","emoji":"☺","quotes":"\"hello\""}""";
        _nextStatusCode = 201;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);

        // Capture the serialized value passed to SET.
        string? capturedSerialized = null;
        r_setHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .Callback<IUpdate.SetInput<string>, CancellationToken, HandlerOptions?>(
                (input, _, _) => capturedSerialized = input.Value)
            .ReturnsAsync(D2Result<IUpdate.SetOutput?>.Ok(new IUpdate.SetOutput()));

        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        capturedSerialized.Should().NotBeNull("SET should have been called");

        // The serialized JSON uses Unicode escape sequences — verify it deserializes back correctly.
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<CachedResponse>(capturedSerialized!);
        deserialized.Should().NotBeNull();
        deserialized!.StatusCode.Should().Be(201);
        deserialized.Body.Should().Be(_nextBody, "round-trip should preserve the original body including special chars");
    }

    /// <summary>
    /// Tests that CachedResponse serialization round-trip preserves all fields.
    /// </summary>
    [Fact]
    public void CachedResponse_SerializationRoundTrip_PreservesAllFields()
    {
        var original = new CachedResponse(
            201,
            """{"id":"abc-123","nested":{"key":"value"}}""",
            "application/json; charset=utf-8");

        var json = System.Text.Json.JsonSerializer.Serialize(original);
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<CachedResponse>(json);

        deserialized.Should().NotBeNull();
        deserialized!.StatusCode.Should().Be(201);
        deserialized.Body.Should().Be(original.Body);
        deserialized.ContentType.Should().Be("application/json; charset=utf-8");
    }

    /// <summary>
    /// Tests that CachedResponse with null body and contentType survives round-trip.
    /// </summary>
    [Fact]
    public void CachedResponse_WithNulls_SurvivesRoundTrip()
    {
        var original = new CachedResponse(204, null, null);

        var json = System.Text.Json.JsonSerializer.Serialize(original);
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<CachedResponse>(json);

        deserialized.Should().NotBeNull();
        deserialized!.StatusCode.Should().Be(204);
        deserialized.Body.Should().BeNull();
        deserialized.ContentType.Should().BeNull();
    }

    /// <summary>
    /// Tests that CachedResponse with Unicode content survives round-trip.
    /// </summary>
    [Fact]
    public void CachedResponse_WithUnicode_SurvivesRoundTrip()
    {
        var bodyWithUnicode = """{"city":"日本語","emoji":"🎉","accent":"café"}""";
        var original = new CachedResponse(200, bodyWithUnicode, "application/json");

        var json = System.Text.Json.JsonSerializer.Serialize(original);
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<CachedResponse>(json);

        deserialized.Should().NotBeNull();
        deserialized!.Body.Should().Be(bodyWithUnicode);
    }

    /// <summary>
    /// Tests that empty JSON object deserializes to CachedResponse with StatusCode 0.
    /// </summary>
    [Fact]
    public void CachedResponse_FromEmptyJsonObject_DeserializesToDefaultStatusCode()
    {
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<CachedResponse>("{}");

        // This documents the behavior: {} → StatusCode 0, null body, null contentType.
        // The Check handler's CachedResponse null check passes, so it would replay status 0.
        deserialized.Should().NotBeNull();
        deserialized!.StatusCode.Should().Be(0, "empty JSON deserializes StatusCode to default 0");
        deserialized.Body.Should().BeNull();
        deserialized.ContentType.Should().BeNull();
    }

    /// <summary>
    /// Tests that downstream 500 response body is still forwarded to client.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenServerErrorResponse_BodyStillForwarded()
    {
        _nextBody = """{"error":"internal server error","details":"stack trace"}""";
        _nextStatusCode = 500;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        // Body should still reach the client even though response isn't cached.
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("internal server error");
        context.Response.StatusCode.Should().Be(500);
    }

    /// <summary>
    /// Tests that the middleware uses the correct idempotency key-prefixed cache key.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenAcquired_UsesCorrectCacheKey()
    {
        _nextBody = """{"ok":true}""";
        _nextStatusCode = 200;
        var idempotencyKey = Guid.NewGuid().ToString();
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = idempotencyKey;
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        var expectedKey = $"idempotency:{idempotencyKey}";
        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.Is<IUpdate.SetInput<string>>(i => i.Key == expectedKey),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that the middleware passes custom TTL to the cache SET call.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenAcquired_UsesCacheTtlFromOptions()
    {
        _nextBody = """{"ok":true}""";
        _nextStatusCode = 200;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware(new IdempotencyOptions { CacheTtl = TimeSpan.FromHours(2) });

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.Is<IUpdate.SetInput<string>>(i => i.Expiration == TimeSpan.FromHours(2)),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that empty body (downstream writes nothing) still caches with null body.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenEmptyBodyResponse_CachesWithNullBody()
    {
        _nextBody = null; // Downstream writes nothing.
        _nextStatusCode = 204;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        // Should still cache (body is null but status is 2xx, size is 0 <= 1MB).
        r_setHandlerMock.Verify(
            x => x.HandleAsync(
                It.Is<IUpdate.SetInput<string>>(i =>
                    i.Value.Contains("204") &&
                    i.Value.Contains("null")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests fail-open when REMOVE handler fails for non-cacheable response.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task InvokeAsync_WhenRemoveFails_DoesNotThrow()
    {
        _nextBody = """{"error":"bad"}""";
        _nextStatusCode = 400;
        var context = CreateHttpContext("POST");
        context.Response.Body = new MemoryStream();
        context.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        SetupCheckReturns(IdempotencyState.Acquired);

        r_removeHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ThrowsAsync(new InvalidOperationException("Redis remove failed"));

        var middleware = CreateMiddleware();

        var act = () => middleware.InvokeAsync(
            context,
            r_checkHandlerMock.Object,
            r_setHandlerMock.Object,
            r_removeHandlerMock.Object);

        await act.Should().NotThrowAsync();

        // Body should still reach the client.
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("bad");
    }

    #endregion

    #region Helper Methods

    private DefaultHttpContext CreateHttpContext(string method = "POST")
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        return context;
    }

    private IdempotencyMiddleware CreateMiddleware(IdempotencyOptions? options = null)
    {
        _nextWasCalled = false;

        return new IdempotencyMiddleware(
            next: async ctx =>
            {
                _nextWasCalled = true;
                ctx.Response.StatusCode = _nextStatusCode;
                if (_nextBody is not null)
                {
                    await ctx.Response.WriteAsync(_nextBody);
                }
            },
            Options.Create(options ?? new IdempotencyOptions()),
            r_loggerMock.Object);
    }

    private void SetupCheckReturns(IdempotencyState state)
    {
        r_checkHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IIdempotency.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IIdempotency.CheckOutput?>.Ok(
                new IIdempotency.CheckOutput(state, null)));
    }

    private void SetupCheckReturnsCached(int statusCode, string? body, string? contentType)
    {
        r_checkHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IIdempotency.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IIdempotency.CheckOutput?>.Ok(
                new IIdempotency.CheckOutput(
                    IdempotencyState.Cached,
                    new CachedResponse(statusCode, body, contentType))));
    }

    private void SetupCheckThrows(Exception exception)
    {
        r_checkHandlerMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IIdempotency.CheckInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ThrowsAsync(exception);
    }

    #endregion
}
