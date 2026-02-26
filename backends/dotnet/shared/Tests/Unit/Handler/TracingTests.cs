// -----------------------------------------------------------------------
// <copyright file="TracingTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Handler;

using System.Diagnostics;
using D2.Shared.Handler;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

/// <summary>
/// Unit tests for <see cref="BaseHandler{THandler,TInput,TOutput}"/> tracing (Activity/span) behavior.
/// </summary>
public class TracingTests
{
    /// <summary>
    /// Verifies that a successful handler execution creates an Activity whose OperationName
    /// matches the handler's type name.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task SuccessfulHandler_CreatesActivityWithHandlerName()
    {
        // Arrange
        Activity? stoppedActivity = null;
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "D2.Shared.Handler",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) =>
                ActivitySamplingResult.AllDataAndRecorded,
            ActivityStopped = activity => stoppedActivity = activity,
        };
        ActivitySource.AddActivityListener(listener);

        var context = CreateContext();
        var handler = new PlainHandler(context);

        // Act
        await handler.HandleAsync("test", ct: TestContext.Current.CancellationToken);

        // Assert
        stoppedActivity.Should().NotBeNull();
        stoppedActivity!.OperationName.Should().Be("PlainHandler");
    }

    /// <summary>
    /// Verifies that a successful handler execution sets the expected metadata tags on the
    /// Activity: handler.type, trace.id, user.id, agent.org.id, and target.org.id.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task SuccessfulHandler_SetsHandlerTypeTags()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var agentOrgId = Guid.NewGuid();
        var targetOrgId = Guid.NewGuid();

        Activity? stoppedActivity = null;
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "D2.Shared.Handler",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) =>
                ActivitySamplingResult.AllDataAndRecorded,
            ActivityStopped = activity => stoppedActivity = activity,
        };
        ActivitySource.AddActivityListener(listener);

        var context = CreateContext(
            traceId: "trace-abc",
            userId: userId,
            agentOrgId: agentOrgId,
            targetOrgId: targetOrgId);
        var handler = new PlainHandler(context);

        // Act
        await handler.HandleAsync("test", ct: TestContext.Current.CancellationToken);

        // Assert
        stoppedActivity.Should().NotBeNull();
        stoppedActivity!.GetTagItem("handler.type").Should().Be(typeof(PlainHandler).FullName);
        stoppedActivity.GetTagItem("trace.id").Should().Be("trace-abc");
        stoppedActivity.GetTagItem("user.id").Should().Be(userId);
        stoppedActivity.GetTagItem("agent.org.id").Should().Be(agentOrgId);
        stoppedActivity.GetTagItem("target.org.id").Should().Be(targetOrgId);
    }

    /// <summary>
    /// Verifies that a successful handler execution sets the success status and result tags
    /// on the Activity: handler.success=true, handler.status.code, and handler.elapsed.ms.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task SuccessfulHandler_SetsSuccessStatusAndTags()
    {
        // Arrange
        Activity? stoppedActivity = null;
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "D2.Shared.Handler",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) =>
                ActivitySamplingResult.AllDataAndRecorded,
            ActivityStopped = activity => stoppedActivity = activity,
        };
        ActivitySource.AddActivityListener(listener);

        var context = CreateContext();
        var handler = new PlainHandler(context);

        // Act
        await handler.HandleAsync("test", ct: TestContext.Current.CancellationToken);

        // Assert
        stoppedActivity.Should().NotBeNull();
        stoppedActivity!.GetTagItem("handler.success").Should().Be(true);
        stoppedActivity.GetTagItem("handler.status.code").Should().Be(HttpStatusCode.OK);
        stoppedActivity.GetTagItem("handler.elapsed.ms").Should().NotBeNull();
        stoppedActivity.Status.Should().Be(ActivityStatusCode.Ok);
    }

    /// <summary>
    /// Verifies that a handler returning D2Result.Fail sets the Activity status to Error
    /// and records handler.success=false.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task FailedHandler_SetsErrorStatus()
    {
        // Arrange
        Activity? stoppedActivity = null;
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "D2.Shared.Handler",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) =>
                ActivitySamplingResult.AllDataAndRecorded,
            ActivityStopped = activity => stoppedActivity = activity,
        };
        ActivitySource.AddActivityListener(listener);

        var context = CreateContext();
        var handler = new FailingHandler(context);

        // Act
        await handler.HandleAsync("test", ct: TestContext.Current.CancellationToken);

        // Assert
        stoppedActivity.Should().NotBeNull();
        stoppedActivity!.Status.Should().Be(ActivityStatusCode.Error);
        stoppedActivity.GetTagItem("handler.success").Should().Be(false);
    }

    /// <summary>
    /// Verifies that a handler throwing an exception sets the Activity status to Error
    /// and records an exception event on the Activity.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ThrowingHandler_SetsErrorStatusAndAddsException()
    {
        // Arrange
        Activity? stoppedActivity = null;
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "D2.Shared.Handler",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) =>
                ActivitySamplingResult.AllDataAndRecorded,
            ActivityStopped = activity => stoppedActivity = activity,
        };
        ActivitySource.AddActivityListener(listener);

        var context = CreateContext();
        var handler = new ThrowingHandler(context);

        // Act
        await handler.HandleAsync("test", ct: TestContext.Current.CancellationToken);

        // Assert
        stoppedActivity.Should().NotBeNull();
        stoppedActivity!.Status.Should().Be(ActivityStatusCode.Error);

        // AddException records an ActivityEvent with name "exception"
        var exceptionEvent = stoppedActivity.Events
            .FirstOrDefault(e => e.Name == "exception");
        exceptionEvent.Name.Should().Be("exception");
        exceptionEvent.Tags
            .Should().Contain(t => t.Key == "exception.type"
                && t.Value!.ToString()!.Contains("InvalidOperationException"));
        exceptionEvent.Tags
            .Should().Contain(t => t.Key == "exception.message"
                && t.Value!.ToString() == "Boom!");
    }

    /// <summary>
    /// Verifies that the BaseHandler auto-injects the ambient TraceId into the result
    /// when the handler returns Ok() without explicitly setting a traceId.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task TraceId_AutoInjectedOnSuccess()
    {
        // Arrange
        var context = CreateContext(traceId: "auto-injected-trace");
        var handler = new NoTraceIdHandler(context);

        // Act
        var result = await handler.HandleAsync("test", ct: TestContext.Current.CancellationToken);

        // Assert — traceId should be auto-injected from the request context
        result.TraceId.Should().Be("auto-injected-trace");
    }

    /// <summary>
    /// Verifies that when a handler explicitly sets a traceId on the result, the BaseHandler
    /// does not override it with the ambient TraceId from the request context.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task TraceId_NotOverriddenIfHandlerSetsIt()
    {
        // Arrange
        var context = CreateContext(traceId: "ambient-trace");
        var handler = new ExplicitTraceIdHandler(context);

        // Act
        var result = await handler.HandleAsync("test", ct: TestContext.Current.CancellationToken);

        // Assert — explicit traceId should be preserved, not overridden by ambient
        result.TraceId.Should().Be("explicit-trace");
    }

    #region Test Helpers

    private static IHandlerContext CreateContext(
        ILogger? logger = null,
        string? traceId = null,
        Guid? userId = null,
        Guid? agentOrgId = null,
        Guid? targetOrgId = null)
    {
        var mockRequest = new Mock<IRequestContext>();
        mockRequest.Setup(r => r.TraceId).Returns(traceId ?? "test-trace");
        mockRequest.Setup(r => r.UserId).Returns(userId ?? Guid.NewGuid());
        mockRequest.Setup(r => r.AgentOrgId).Returns(agentOrgId ?? Guid.NewGuid());
        mockRequest.Setup(r => r.TargetOrgId).Returns(targetOrgId ?? Guid.NewGuid());

        var mockContext = new Mock<IHandlerContext>();
        mockContext.Setup(c => c.Request).Returns(mockRequest.Object);
        mockContext.Setup(c => c.Logger).Returns(logger ?? Mock.Of<ILogger>());
        return mockContext.Object;
    }

    private class PlainHandler : BaseHandler<PlainHandler, string, string>
    {
        public PlainHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input.ToUpperInvariant()));
    }

    private class ThrowingHandler : BaseHandler<ThrowingHandler, string, string>
    {
        public ThrowingHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => throw new InvalidOperationException("Boom!");
    }

    private class NoTraceIdHandler : BaseHandler<NoTraceIdHandler, string, string>
    {
        public NoTraceIdHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input));
    }

    private class ExplicitTraceIdHandler : BaseHandler<ExplicitTraceIdHandler, string, string>
    {
        public ExplicitTraceIdHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input, traceId: "explicit-trace"));
    }

    private class FailingHandler : BaseHandler<FailingHandler, string, string>
    {
        public FailingHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Fail(["test error"]));
    }

    #endregion
}
