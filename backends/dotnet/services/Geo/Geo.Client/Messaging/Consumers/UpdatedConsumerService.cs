// -----------------------------------------------------------------------
// <copyright file="UpdatedConsumerService.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Messaging.Consumers;

using D2.Events.Protos.V1;
using D2.Geo.Client.Interfaces.Messaging.Handlers.Sub;
using D2.Shared.Interfaces.Messaging;
using D2.Shared.Messaging.RabbitMQ.Conventions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

/// <summary>
/// Background service that consumes geographic reference data updated events.
/// Creates an exclusive auto-delete queue per instance (broadcast semantics).
/// </summary>
public class UpdatedConsumerService : BackgroundService
{
    private readonly IMessageBus r_messageBus;
    private readonly IServiceScopeFactory r_scopeFactory;
    private readonly ILogger<UpdatedConsumerService> r_logger;

    private IAsyncDisposable? _subscription;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdatedConsumerService"/> class.
    /// </summary>
    ///
    /// <param name="messageBus">
    /// The message bus for subscribing to events.
    /// </param>
    /// <param name="scopeFactory">
    /// The service scope factory for resolving scoped handlers.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    public UpdatedConsumerService(
        IMessageBus messageBus,
        IServiceScopeFactory scopeFactory,
        ILogger<UpdatedConsumerService> logger)
    {
        r_messageBus = messageBus;
        r_scopeFactory = scopeFactory;
        r_logger = logger;
    }

    /// <summary>
    /// Stops the consumer and disposes resources.
    /// </summary>
    ///
    /// <param name="cancellationToken">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous stop operation.
    /// </returns>
    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_subscription is not null)
        {
            await _subscription.DisposeAsync();
        }

        await base.StopAsync(cancellationToken);
    }

    /// <summary>
    /// Starts the consumer background service.
    /// </summary>
    ///
    /// <param name="stoppingToken">
    /// The cancellation token that signals when the host is stopping.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the long-running operation.
    /// </returns>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var instanceId = Guid.NewGuid().ToString("N")[..8];

        _subscription = await r_messageBus.SubscribeAsync<GeoRefDataUpdatedEvent>(
            new ConsumerConfig
            {
                Exchange = AmqpConventions.EventExchange("geo"),
                InstanceId = instanceId,
            },
            async (message, ct) =>
            {
                r_logger.LogInformation(
                    "Received GeoRefDataUpdated event for version {Version}",
                    message.Body.Version);

                await using var scope = r_scopeFactory.CreateAsyncScope();
                var handler = scope.ServiceProvider.GetRequiredService<ISubs.IUpdatedHandler>();

                var result = await handler.HandleAsync(message.Body, ct);

                if (result.Failed)
                {
                    r_logger.LogError(
                        "Failed to process GeoRefDataUpdated event for version {Version}",
                        message.Body.Version);

                    return ConsumerResult.Drop;
                }

                r_logger.LogInformation(
                    "Successfully processed GeoRefDataUpdated event for version {Version}",
                    message.Body.Version);

                return ConsumerResult.Ack;
            },
            stoppingToken);
    }
}
