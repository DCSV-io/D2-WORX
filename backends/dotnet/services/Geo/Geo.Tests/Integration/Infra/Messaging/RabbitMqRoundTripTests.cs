// -----------------------------------------------------------------------
// <copyright file="RabbitMqRoundTripTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.Infra.Messaging;

using D2.Geo.Client.Interfaces.Messaging.Handlers.Sub;
using D2.Geo.Client.Messages;
using D2.Geo.Client.Messaging.MT.Consumers;
using D2.Shared.Handler;
using D2.Shared.Result;
using JetBrains.Annotations;
using MassTransit;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Testcontainers.RabbitMq;
using Xunit;

/// <summary>
/// Round-trip integration tests that publish messages via MassTransit to a real RabbitMQ container
/// and verify the UpdatedConsumer processes them correctly.
/// </summary>
[MustDisposeResource(false)]
public class RabbitMqRoundTripTests : IAsyncLifetime
{
    private RabbitMqContainer _container = null!;
    private ServiceProvider _services = null!;
    private TaskCompletionSource<GeoRefDataUpdated> _handlerTcs = null!;
    private Mock<ISubs.IUpdatedHandler> _mockHandler = null!;

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _container = new RabbitMqBuilder()
            .WithImage("rabbitmq:4.1-management")
            .Build();
        await _container.StartAsync(Ct);

        _handlerTcs = new TaskCompletionSource<GeoRefDataUpdated>();
        _mockHandler = new Mock<ISubs.IUpdatedHandler>();
        _mockHandler
            .Setup(h => h.HandleAsync(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .Returns<GeoRefDataUpdated, CancellationToken, HandlerOptions?>((msg, _, _) =>
            {
                _handlerTcs.TrySetResult(msg);
                return new ValueTask<D2Result<ISubs.UpdatedOutput?>>(
                    D2Result<ISubs.UpdatedOutput?>.Ok(new ISubs.UpdatedOutput()));
            });

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddTransient<ISubs.IUpdatedHandler>(_ => _mockHandler.Object);
        services.AddTransient(_ => ClientTestHelpers.CreateHandlerContext());
        services.AddMassTransit(x =>
        {
            x.AddConsumer<UpdatedConsumer>();
            x.UsingRabbitMq((context, cfg) =>
            {
                cfg.Host(_container.GetConnectionString());
                cfg.UseMessageRetry(r => r.Immediate(3));
                cfg.ConfigureEndpoints(context);
            });
        });

        _services = services.BuildServiceProvider();

        // Wait for MassTransit bus to start and connect to RabbitMQ.
        var busControl = _services.GetRequiredService<IBusControl>();
        await busControl.StartAsync(Ct);
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        // Stop MassTransit bus before disposing to avoid RabbitMQ.Client
        // ObjectDisposedException race during channel shutdown.
        var busControl = _services.GetRequiredService<IBusControl>();
        await busControl.StopAsync(CancellationToken.None);
        await _services.DisposeAsync();
        await _container.DisposeAsync();
    }

    /// <summary>
    /// Tests that a published GeoRefDataUpdated message is delivered to the UpdatedConsumer
    /// and the mock handler receives the correct version.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Publish_GeoRefDataUpdated_ConsumerReceivesCorrectVersion()
    {
        // Arrange
        var publishEndpoint = _services.GetRequiredService<IPublishEndpoint>();

        // Act
        await publishEndpoint.Publish(new GeoRefDataUpdated("3.0.0"), Ct);

        // Assert — wait for the consumer to process the message.
        var received = await _handlerTcs.Task.WaitAsync(TimeSpan.FromSeconds(10), Ct);
        Assert.Equal("3.0.0", received.Version);
        _mockHandler.Verify(
            h => h.HandleAsync(
                It.Is<GeoRefDataUpdated>(m => m.Version == "3.0.0"),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that when the handler fails (throws), MassTransit retries and the handler
    /// is eventually called again.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Publish_WhenHandlerFails_MassTransitRetries()
    {
        // Arrange — first call throws (simulating consumer throw on D2Result.Fail),
        // second call succeeds.
        var callCount = 0;
        var secondCallTcs = new TaskCompletionSource<GeoRefDataUpdated>();
        _mockHandler.Reset();
        _mockHandler
            .Setup(h => h.HandleAsync(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .Returns<GeoRefDataUpdated, CancellationToken, HandlerOptions?>((msg, _, _) =>
            {
                callCount++;
                if (callCount == 1)
                {
                    // Return failure — UpdatedConsumer will throw, triggering retry.
                    return new ValueTask<D2Result<ISubs.UpdatedOutput?>>(
                        D2Result<ISubs.UpdatedOutput?>.Fail(["Transient failure"]));
                }

                secondCallTcs.TrySetResult(msg);
                return new ValueTask<D2Result<ISubs.UpdatedOutput?>>(
                    D2Result<ISubs.UpdatedOutput?>.Ok(new ISubs.UpdatedOutput()));
            });

        var publishEndpoint = _services.GetRequiredService<IPublishEndpoint>();

        // Act
        await publishEndpoint.Publish(new GeoRefDataUpdated("4.0.0"), Ct);

        // Assert — wait for the second (retry) call.
        var received = await secondCallTcs.Task.WaitAsync(TimeSpan.FromSeconds(30), Ct);
        Assert.Equal("4.0.0", received.Version);
        Assert.True(callCount >= 2, $"Expected handler to be called at least twice, was called {callCount} times.");
    }

    /// <summary>
    /// Tests that publishing multiple different versions delivers all of them to the consumer.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Publish_MultipleMessages_AllDelivered()
    {
        // Arrange
        var receivedVersions = new List<string>();
        var allReceived = new TaskCompletionSource();
        _mockHandler.Reset();
        _mockHandler
            .Setup(h => h.HandleAsync(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .Returns<GeoRefDataUpdated, CancellationToken, HandlerOptions?>((msg, _, _) =>
            {
                lock (receivedVersions)
                {
                    receivedVersions.Add(msg.Version);
                    if (receivedVersions.Count == 2)
                    {
                        allReceived.TrySetResult();
                    }
                }

                return new ValueTask<D2Result<ISubs.UpdatedOutput?>>(
                    D2Result<ISubs.UpdatedOutput?>.Ok(new ISubs.UpdatedOutput()));
            });

        var publishEndpoint = _services.GetRequiredService<IPublishEndpoint>();

        // Act
        await publishEndpoint.Publish(new GeoRefDataUpdated("5.0.0"), Ct);
        await publishEndpoint.Publish(new GeoRefDataUpdated("6.0.0"), Ct);

        // Assert — wait for both messages to be processed.
        await allReceived.Task.WaitAsync(TimeSpan.FromSeconds(10), Ct);
        Assert.Contains("5.0.0", receivedVersions);
        Assert.Contains("6.0.0", receivedVersions);
    }
}
