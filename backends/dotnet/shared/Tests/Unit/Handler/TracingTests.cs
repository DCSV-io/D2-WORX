// -----------------------------------------------------------------------
// <copyright file="TracingTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Handler;

using System.Collections.Concurrent;
using System.Diagnostics;
using D2.Shared.Handler;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

/// <summary>
/// Unit tests for <see cref="BaseHandler{THandler,TInput,TOutput}"/> tracing (Activity/span) behavior.
/// </summary>
/// <remarks>
/// Handler types are uniquely prefixed ("Tracing_") so that the global <see cref="ActivityListener"/>
/// can filter by <see cref="Activity.OperationName"/> without colliding with handlers created by
/// other test classes running in parallel (e.g. <see cref="DefaultOptionsTests"/>).
/// </remarks>
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
        var activity = await RunWithActivityCapture<TracingPlainHandler>(
            CreateContext());

        // Assert
        activity.Should().NotBeNull();
        activity!.OperationName.Should().Be(nameof(TracingPlainHandler));
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

        var context = CreateContext(
            traceId: "trace-abc",
            userId: userId,
            agentOrgId: agentOrgId,
            targetOrgId: targetOrgId);

        var activity = await RunWithActivityCapture<TracingTagsHandler>(context);

        // Assert
        activity.Should().NotBeNull();
        activity!.GetTagItem("handler.type").Should().Be(typeof(TracingTagsHandler).FullName);
        activity.GetTagItem("trace.id").Should().Be("trace-abc");

        // SetTagIfNotNull converts values to string via .ToString() for OTel compatibility.
        activity.GetTagItem("user.id").Should().Be(userId.ToString());
        activity.GetTagItem("agent.org.id").Should().Be(agentOrgId.ToString());
        activity.GetTagItem("target.org.id").Should().Be(targetOrgId.ToString());
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
        var activity = await RunWithActivityCapture<TracingSuccessHandler>(
            CreateContext());

        // Assert
        activity.Should().NotBeNull();
        activity!.GetTagItem("handler.success").Should().Be(true);
        activity.GetTagItem("handler.status.code").Should().Be(HttpStatusCode.OK);
        activity.GetTagItem("handler.elapsed.ms").Should().NotBeNull();
        activity.Status.Should().Be(ActivityStatusCode.Ok);
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
        var activity = await RunWithActivityCapture<TracingFailingHandler>(
            CreateContext());

        // Assert
        activity.Should().NotBeNull();
        activity!.Status.Should().Be(ActivityStatusCode.Error);
        activity.GetTagItem("handler.success").Should().Be(false);
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
        var activity = await RunWithActivityCapture<TracingThrowingHandler>(
            CreateContext());

        // Assert
        activity.Should().NotBeNull();
        activity!.Status.Should().Be(ActivityStatusCode.Error);

        // AddException records an ActivityEvent with name "exception"
        var exceptionEvent = activity.Events
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
        var handler = new TracingNoTraceIdHandler(context);

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
        var handler = new TracingExplicitTraceIdHandler(context);

        // Act
        var result = await handler.HandleAsync("test", ct: TestContext.Current.CancellationToken);

        // Assert — explicit traceId should be preserved, not overridden by ambient
        result.TraceId.Should().Be("explicit-trace");
    }

    #region Test Helpers

    /// <summary>
    /// Runs a handler of the specified type while capturing activities from the shared
    /// <c>D2.Shared.Handler</c> ActivitySource. Returns the activity matching the handler's
    /// OperationName, filtering out activities from other handlers running in parallel.
    /// </summary>
    private static async Task<Activity?> RunWithActivityCapture<THandler>(
        IHandlerContext context)
        where THandler : BaseHandler<THandler, string, string>
    {
        var stoppedActivities = new ConcurrentBag<Activity>();
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "D2.Shared.Handler",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) =>
                ActivitySamplingResult.AllDataAndRecorded,
            ActivityStopped = activity => stoppedActivities.Add(activity),
        };
        ActivitySource.AddActivityListener(listener);

        var handler = (THandler)Activator.CreateInstance(typeof(THandler), context)!;
        await handler.HandleAsync("test", ct: TestContext.Current.CancellationToken);

        return stoppedActivities.FirstOrDefault(a =>
            a.OperationName == typeof(THandler).Name);
    }

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

    // Each handler type has a unique "Tracing_" prefix so that its Activity.OperationName
    // is distinguishable from handlers created by other parallel test classes.
    private class TracingPlainHandler : BaseHandler<TracingPlainHandler, string, string>
    {
        public TracingPlainHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input.ToUpperInvariant()));
    }

    private class TracingTagsHandler : BaseHandler<TracingTagsHandler, string, string>
    {
        public TracingTagsHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input.ToUpperInvariant()));
    }

    private class TracingSuccessHandler : BaseHandler<TracingSuccessHandler, string, string>
    {
        public TracingSuccessHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input.ToUpperInvariant()));
    }

    private class TracingThrowingHandler : BaseHandler<TracingThrowingHandler, string, string>
    {
        public TracingThrowingHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => throw new InvalidOperationException("Boom!");
    }

    private class TracingNoTraceIdHandler : BaseHandler<TracingNoTraceIdHandler, string, string>
    {
        public TracingNoTraceIdHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input));
    }

    private class TracingExplicitTraceIdHandler : BaseHandler<TracingExplicitTraceIdHandler, string, string>
    {
        public TracingExplicitTraceIdHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Ok(input, traceId: "explicit-trace"));
    }

    private class TracingFailingHandler : BaseHandler<TracingFailingHandler, string, string>
    {
        public TracingFailingHandler(IHandlerContext context)
            : base(context)
        {
        }

        protected override ValueTask<D2Result<string?>> ExecuteAsync(
            string input, CancellationToken ct = default)
            => ValueTask.FromResult(D2Result<string?>.Fail(["test error"]));
    }

    #endregion
}
