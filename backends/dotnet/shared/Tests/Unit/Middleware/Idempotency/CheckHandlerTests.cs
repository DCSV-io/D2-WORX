// -----------------------------------------------------------------------
// <copyright file="CheckHandlerTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Middleware.Idempotency;

using System.Text.Json;
using D2.Shared.Handler;
using D2.Shared.Idempotency.Default;
using D2.Shared.Idempotency.Default.Handlers.X;
using D2.Shared.Idempotency.Default.Interfaces;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.C;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.R;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

/// <summary>
/// Unit tests for the idempotency <see cref="Check"/> handler.
/// </summary>
public class CheckHandlerTests
{
    private readonly Mock<ICreate.ISetNxHandler<string>> r_setNxMock;
    private readonly Mock<IRead.IGetHandler<string>> r_getMock;

    /// <summary>
    /// Initializes a new instance of the <see cref="CheckHandlerTests"/> class.
    /// </summary>
    public CheckHandlerTests()
    {
        r_setNxMock = new Mock<ICreate.ISetNxHandler<string>>();
        r_getMock = new Mock<IRead.IGetHandler<string>>();
    }

    /// <summary>
    /// Tests that a successful SET NX returns the Acquired state.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenSetNxSucceeds_ReturnsAcquired()
    {
        SetupSetNx(wasSet: true);
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Acquired);
        result.Data.CachedResponse.Should().BeNull();
    }

    /// <summary>
    /// Tests that the InFlight state is returned when the sentinel value exists.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenSentinelExists_ReturnsInFlight()
    {
        SetupSetNx(wasSet: false);
        SetupGet("__processing__");
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.InFlight);
        result.Data.CachedResponse.Should().BeNull();
    }

    /// <summary>
    /// Tests that a cached response is returned with correct status, body, and content type.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenCachedResponseExists_ReturnsCached()
    {
        var cached = new CachedResponse(201, """{"id":"123"}""", "application/json");
        SetupSetNx(wasSet: false);
        SetupGet(JsonSerializer.Serialize(cached));
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Cached);
        result.Data.CachedResponse.Should().NotBeNull();
        result.Data.CachedResponse!.StatusCode.Should().Be(201);
        result.Data.CachedResponse.Body.Should().Be("""{"id":"123"}""");
        result.Data.CachedResponse.ContentType.Should().Be("application/json");
    }

    /// <summary>
    /// Tests that the handler fails open when SET NX returns a failure result.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenSetNxFails_FailsOpen()
    {
        r_setNxMock
            .Setup(x => x.HandleAsync(
                It.IsAny<ICreate.SetNxInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<ICreate.SetNxOutput?>.Fail(["Redis error"]));

        // GET also fails to simulate full cache failure.
        r_getMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetOutput<string>?>.Fail(["Redis error"]));

        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Acquired);
    }

    /// <summary>
    /// Tests that the handler fails open when GET throws an exception.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenGetThrows_FailsOpen()
    {
        SetupSetNx(wasSet: false);

        r_getMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ThrowsAsync(new InvalidOperationException("Redis timeout"));

        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Acquired);
    }

    /// <summary>
    /// Tests that the handler fails open when cached value is invalid JSON.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenInvalidJson_FailsOpen()
    {
        SetupSetNx(wasSet: false);
        SetupGet("not valid json {{{");
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Acquired);
    }

    /// <summary>
    /// Tests that the handler uses the correct cache key prefix.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_UsesCacheKeyPrefix()
    {
        SetupSetNx(wasSet: true);
        var handler = CreateHandler();

        await handler.HandleAsync(
            new IIdempotency.CheckInput("my-key-123"),
            TestContext.Current.CancellationToken);

        r_setNxMock.Verify(
            x => x.HandleAsync(
                It.Is<ICreate.SetNxInput<string>>(i => i.Key == "idempotency:my-key-123"),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that the handler fails open when GET returns a null value.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenGetReturnsNull_FailsOpenAsAcquired()
    {
        SetupSetNx(wasSet: false);

        r_getMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetOutput<string>?>.Ok(
                new IRead.GetOutput<string>(null!)));

        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Acquired);
    }

    /// <summary>
    /// Tests that the handler fails open when GET returns NotFound.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenGetReturnsNotFound_FailsOpenAsAcquired()
    {
        SetupSetNx(wasSet: false);

        r_getMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetOutput<string>?>.NotFound());

        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        // Check handler wraps the GET call: NotFound → CheckSuccess returns false → fail-open.
        // The overall Check result is still Success (Acquired).
        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Acquired);
    }

    /// <summary>
    /// Tests that an empty JSON object deserializes to Cached state with StatusCode 0.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenEmptyJsonObject_ReturnsCachedWithStatusZero()
    {
        SetupSetNx(wasSet: false);
        SetupGet("{}");
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();

        // {} deserializes to CachedResponse(0, null, null) — not null, so state is Cached.
        result.Data!.State.Should().Be(IdempotencyState.Cached);
        result.Data.CachedResponse.Should().NotBeNull();
        result.Data.CachedResponse!.StatusCode.Should().Be(0);
    }

    /// <summary>
    /// Tests that cached response with Unicode body deserializes correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenCachedResponseHasUnicode_DeserializesCorrectly()
    {
        var cached = new CachedResponse(200, """{"city":"日本語","emoji":"🎉"}""", "application/json");
        SetupSetNx(wasSet: false);
        SetupGet(JsonSerializer.Serialize(cached));
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Cached);
        result.Data.CachedResponse!.Body.Should().Contain("日本語");
        result.Data.CachedResponse.Body.Should().Contain("🎉");
    }

    /// <summary>
    /// Tests that cached response with nested escaped JSON deserializes correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenCachedResponseHasEscapedJson_DeserializesCorrectly()
    {
        var bodyWithNestedJson = """{"data":"{\"key\":\"value\"}"}""";
        var cached = new CachedResponse(200, bodyWithNestedJson, "application/json");
        SetupSetNx(wasSet: false);
        SetupGet(JsonSerializer.Serialize(cached));
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Cached);
        result.Data.CachedResponse!.Body.Should().Be(bodyWithNestedJson);
    }

    /// <summary>
    /// Tests that a JSON array in cache causes fail-open since it cannot deserialize to CachedResponse.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenJsonArrayInCache_FailsOpen()
    {
        SetupSetNx(wasSet: false);
        SetupGet("[1, 2, 3]");
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        // JSON array can't deserialize to CachedResponse record — throws JsonException → fail-open.
        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Acquired);
    }

    /// <summary>
    /// Tests that a partial JSON object with only StatusCode returns Cached with default nulls.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenPartialJsonObject_ReturnsCachedWithDefaults()
    {
        SetupSetNx(wasSet: false);
        SetupGet("""{"StatusCode":422}""");
        var handler = CreateHandler();

        var result = await handler.HandleAsync(
            new IIdempotency.CheckInput("test-key"),
            TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Data!.State.Should().Be(IdempotencyState.Cached);
        result.Data.CachedResponse!.StatusCode.Should().Be(422);
        result.Data.CachedResponse.Body.Should().BeNull();
        result.Data.CachedResponse.ContentType.Should().BeNull();
    }

    #region Helper Methods

    private Check CreateHandler()
    {
        return new Check(
            r_setNxMock.Object,
            r_getMock.Object,
            Options.Create(new IdempotencyOptions()),
            TestHelpers.CreateHandlerContext());
    }

    private void SetupSetNx(bool wasSet)
    {
        r_setNxMock
            .Setup(x => x.HandleAsync(
                It.IsAny<ICreate.SetNxInput<string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<ICreate.SetNxOutput?>.Ok(
                new ICreate.SetNxOutput(wasSet)));
    }

    private void SetupGet(string value)
    {
        r_getMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetOutput<string>?>.Ok(
                new IRead.GetOutput<string>(value)));
    }

    #endregion
}
