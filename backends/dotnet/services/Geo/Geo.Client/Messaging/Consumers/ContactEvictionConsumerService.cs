// -----------------------------------------------------------------------
// <copyright file="ContactEvictionConsumerService.cs" company="DCSV">
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
/// Background service that consumes contact eviction events.
/// Creates an exclusive auto-delete queue per instance (broadcast semantics).
/// </summary>
public class ContactEvictionConsumerService : BackgroundService
{
    private readonly IConnection r_connection;
    private readonly IServiceScopeFactory r_scopeFactory;
    private readonly ILogger<ContactEvictionConsumerService> r_logger;

    private ProtoConsumer<ContactsEvictedEvent>? _consumer;

    /// <summary>
    /// Initializes a new instance of the <see cref="ContactEvictionConsumerService"/> class.
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
    public ContactEvictionConsumerService(
        IConnection connection,
        IServiceScopeFactory scopeFactory,
        ILogger<ContactEvictionConsumerService> logger)
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

        _consumer = await ProtoConsumer<ContactsEvictedEvent>.CreateBroadcastAsync(
            r_connection,
            AmqpConventions.EventExchange("geo.contacts"),
            instanceId,
            async (message, ct) =>
            {
                r_logger.LogInformation(
                    "Received ContactsEvicted event for {IdCount} contact(s)",
                    message.Contacts.Count);

                await using var scope = r_scopeFactory.CreateAsyncScope();
                var handler = scope.ServiceProvider.GetRequiredService<ISubs.IContactsEvictedHandler>();

                var result = await handler.HandleAsync(message, ct);

                if (result.Failed)
                {
                    r_logger.LogError(
                        "Failed to process ContactsEvicted event");

                    throw new InvalidOperationException(
                        "Failed to process ContactsEvicted event");
                }

                r_logger.LogInformation(
                    "Successfully processed ContactsEvicted event for {IdCount} contact(s)",
                    message.Contacts.Count);
            },
            r_logger,
            stoppingToken);
    }
}
