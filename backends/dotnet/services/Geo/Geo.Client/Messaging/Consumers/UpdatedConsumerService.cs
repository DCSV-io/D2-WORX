// -----------------------------------------------------------------------
// <copyright file="UpdatedConsumerService.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Messaging.Consumers;

using D2.Events.Protos.V1;
using D2.Geo.Client.Interfaces.Messaging.Handlers.Sub;
using D2.Shared.Messaging.RabbitMQ;
using D2.Shared.Messaging.RabbitMQ.Conventions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;

/// <summary>
/// Background service that consumes geographic reference data updated events.
/// Creates an exclusive auto-delete queue per instance (broadcast semantics).
/// </summary>
public class UpdatedConsumerService : BackgroundService
{
    private readonly IConnection r_connection;
    private readonly IServiceScopeFactory r_scopeFactory;
    private readonly ILogger<UpdatedConsumerService> r_logger;

    private ProtoConsumer<GeoRefDataUpdatedEvent>? _consumer;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdatedConsumerService"/> class.
    /// </summary>
    ///
    /// <param name="connection">
    /// The RabbitMQ connection.
    /// </param>
    /// <param name="scopeFactory">
    /// The service scope factory for resolving scoped handlers.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    public UpdatedConsumerService(
        IConnection connection,
        IServiceScopeFactory scopeFactory,
        ILogger<UpdatedConsumerService> logger)
    {
        r_connection = connection;
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
        if (_consumer is not null)
        {
            await _consumer.DisposeAsync();
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

        _consumer = await ProtoConsumer<GeoRefDataUpdatedEvent>.CreateBroadcastAsync(
            r_connection,
            AmqpConventions.EventExchange("geo"),
            instanceId,
            async (message, ct) =>
            {
                r_logger.LogInformation(
                    "Received GeoRefDataUpdated event for version {Version}",
                    message.Version);

                await using var scope = r_scopeFactory.CreateAsyncScope();
                var handler = scope.ServiceProvider.GetRequiredService<ISubs.IUpdatedHandler>();

                var result = await handler.HandleAsync(message, ct);

                if (result.Failed)
                {
                    r_logger.LogError(
                        "Failed to process GeoRefDataUpdated event for version {Version}",
                        message.Version);

                    throw new InvalidOperationException(
                        $"Failed to process GeoRefDataUpdated event for version {message.Version}");
                }

                r_logger.LogInformation(
                    "Successfully processed GeoRefDataUpdated event for version {Version}",
                    message.Version);
            },
            r_logger,
            stoppingToken);
    }
}
