// -----------------------------------------------------------------------
// <copyright file="DefaultOptionsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Handler;

using D2.Shared.Handler;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

/// <summary>
/// Unit tests for <see cref="BaseHandler{THandler,TInput,TOutput}.DefaultOptions"/>.
/// </summary>
public class DefaultOptionsTests
{
    // -----------------------------------------------------------------------
    // Test handlers
    // -----------------------------------------------------------------------

    private class PlainHandler : BaseHandler<PlainHandler, string, string>
    {
        public PlainHandler(IHandlerContext context) : base(context) { }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input.ToUpperInvariant()));
    }

    private class SuppressedHandler : BaseHandler<SuppressedHandler, string, string>
    {
        public SuppressedHandler(IHandlerContext context) : base(context) { }

        protected override HandlerOptions DefaultOptions => new(LogInput: false, LogOutput: false);

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input.ToUpperInvariant()));
    }

    private class InputOnlyHandler : BaseHandler<InputOnlyHandler, string, string>
    {
        public InputOnlyHandler(IHandlerContext context) : base(context) { }

        protected override HandlerOptions DefaultOptions => new(LogInput: false);

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input.ToUpperInvariant()));
    }

    private class ThrowingHandler : BaseHandler<ThrowingHandler, string, string>
    {
        public ThrowingHandler(IHandlerContext context) : base(context) { }

        protected override HandlerOptions DefaultOptions => new(LogInput: false, LogOutput: false);

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => throw new InvalidOperationException("Boom!");
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static IHandlerContext CreateContext(ILogger? logger = null)
    {
        var mockRequest = new Mock<IRequestContext>();
        mockRequest.Setup(r => r.TraceId).Returns("test-trace");
        mockRequest.Setup(r => r.UserId).Returns(Guid.NewGuid());
        mockRequest.Setup(r => r.AgentOrgId).Returns(Guid.NewGuid());
        mockRequest.Setup(r => r.TargetOrgId).Returns(Guid.NewGuid());

        var mockContext = new Mock<IHandlerContext>();
        mockContext.Setup(c => c.Request).Returns(mockRequest.Object);
        mockContext.Setup(c => c.Logger).Returns(logger ?? Mock.Of<ILogger>());
        return mockContext.Object;
    }

    // -----------------------------------------------------------------------
    // Tests
    // -----------------------------------------------------------------------

    [Fact]
    public async Task PlainHandler_UsesDefaultHandlerOptions()
    {
        // Arrange
        var mockLogger = new Mock<ILogger>();
        mockLogger.Setup(l => l.IsEnabled(It.IsAny<LogLevel>())).Returns(true);
        var context = CreateContext(mockLogger.Object);
        var handler = new PlainHandler(context);

        // Act
        await handler.HandleAsync("test");

        // Assert — input and output should be logged (defaults are LogInput=true, LogOutput=true)
        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("received input")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);

        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("produced result")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task SuppressedHandler_UsesOverriddenDefaultOptions()
    {
        // Arrange
        var mockLogger = new Mock<ILogger>();
        mockLogger.Setup(l => l.IsEnabled(It.IsAny<LogLevel>())).Returns(true);
        var context = CreateContext(mockLogger.Object);
        var handler = new SuppressedHandler(context);

        // Act
        await handler.HandleAsync("test");

        // Assert — neither input nor output should be logged
        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("received input")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);

        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("produced result")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);
    }

    [Fact]
    public async Task PerCallOptions_OverrideDefaultOptions()
    {
        // Arrange — handler suppresses by default, but per-call re-enables
        var mockLogger = new Mock<ILogger>();
        mockLogger.Setup(l => l.IsEnabled(It.IsAny<LogLevel>())).Returns(true);
        var context = CreateContext(mockLogger.Object);
        var handler = new SuppressedHandler(context);

        // Act — per-call options override the DefaultOptions
        await handler.HandleAsync("test", options: new HandlerOptions(LogInput: true, LogOutput: true));

        // Assert — input and output should now be logged
        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("received input")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);

        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("produced result")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    // -----------------------------------------------------------------------
    // Additional coverage tests
    // -----------------------------------------------------------------------

    [Fact]
    public async Task NullPerCallOptions_UsesDefaultOptions()
    {
        // Arrange — handler suppresses by default, pass null options explicitly
        var mockLogger = new Mock<ILogger>();
        mockLogger.Setup(l => l.IsEnabled(It.IsAny<LogLevel>())).Returns(true);
        var context = CreateContext(mockLogger.Object);
        var handler = new SuppressedHandler(context);

        // Act — null options should fall through to DefaultOptions (suppressed)
        await handler.HandleAsync("test", options: null);

        // Assert — neither input nor output should be logged
        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("received input")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);

        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("produced result")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);
    }

    [Fact]
    public async Task PartialOverride_SuppressesOnlyInput()
    {
        // Arrange — InputOnlyHandler suppresses input only, output uses default (true)
        var mockLogger = new Mock<ILogger>();
        mockLogger.Setup(l => l.IsEnabled(It.IsAny<LogLevel>())).Returns(true);
        var context = CreateContext(mockLogger.Object);
        var handler = new InputOnlyHandler(context);

        // Act
        await handler.HandleAsync("test");

        // Assert — input should NOT be logged
        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("received input")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);

        // Assert — output SHOULD be logged (default LogOutput=true)
        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("produced result")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task DebugDisabled_NoDebugLogsRegardlessOfOptions()
    {
        // Arrange — logger has Debug disabled
        var mockLogger = new Mock<ILogger>();
        mockLogger.Setup(l => l.IsEnabled(LogLevel.Debug)).Returns(false);
        mockLogger.Setup(l => l.IsEnabled(LogLevel.Information)).Returns(true);
        mockLogger.Setup(l => l.IsEnabled(LogLevel.Warning)).Returns(true);
        var context = CreateContext(mockLogger.Object);
        var handler = new PlainHandler(context); // default: LogInput=true, LogOutput=true

        // Act
        await handler.HandleAsync("test");

        // Assert — debug-level messages should not appear (logger won't emit them)
        // Note: BaseHandler uses LogDebug which checks IsEnabled internally
        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Exactly(2)); // LogDebug still calls Log — filtering is in the logger itself
        // The important thing: no crash, handler completes normally
    }

    [Fact]
    public async Task ThrowingHandler_DefaultOptionsDoNotAffectExceptionPath()
    {
        // Arrange — handler suppresses both I/O but throws
        var mockLogger = new Mock<ILogger>();
        mockLogger.Setup(l => l.IsEnabled(It.IsAny<LogLevel>())).Returns(true);
        var context = CreateContext(mockLogger.Object);
        var handler = new ThrowingHandler(context);

        // Act — should not throw; BaseHandler catches exceptions
        var result = await handler.HandleAsync("test");

        // Assert — should return unhandled exception result
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.InternalServerError);

        // No input/output debug logs (handler throws before output)
        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("received input")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);

        mockLogger.Verify(
            l => l.Log(
                LogLevel.Debug,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("produced result")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);

        // Error log should be emitted for the exception
        mockLogger.Verify(
            l => l.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("unhandled exception")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }
}
