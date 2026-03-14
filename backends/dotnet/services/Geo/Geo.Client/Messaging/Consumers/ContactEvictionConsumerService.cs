// -----------------------------------------------------------------------
// <copyright file="ContactEvictionConsumerService.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Messaging.Consumers;

using D2.Events.Protos.V1;
using D2.Geo.Client.Interfaces.Messaging.Handlers.Sub;
using D2.Shared.Interfaces.Messaging;
using D2.Shared.Messaging.RabbitMQ.Conventions;
using JetBrains.Annotations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

/// <summary>
/// Background service that consumes contact eviction events.
/// Creates an exclusive auto-delete queue per instance (broadcast semantics).
/// </summary>
[MustDisposeResource(false)]
public partial class ContactEvictionConsumerService : BackgroundService
{
    private readonly IMessageBus r_messageBus;
    private readonly IServiceScopeFactory r_scopeFactory;
    private readonly ILogger<ContactEvictionConsumerService> r_logger;

    private IAsyncDisposable? _subscription;

    /// <summary>
    /// Initializes a new instance of the <see cref="ContactEvictionConsumerService"/> class.
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
    [MustDisposeResource(false)]
    public ContactEvictionConsumerService(
        IMessageBus messageBus,
        IServiceScopeFactory scopeFactory,
        ILogger<ContactEvictionConsumerService> logger)
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

        _subscription = await r_messageBus.SubscribeAsync<ContactsEvictedEvent>(
            new ConsumerConfig
            {
                Exchange = AmqpConventions.EventExchange("geo.contacts"),
                InstanceId = instanceId,
            },
            async (message, ct) =>
            {
                LogEventReceived(r_logger, message.Body.Contacts.Count);

                await using var scope = r_scopeFactory.CreateAsyncScope();
                var handler = scope.ServiceProvider.GetRequiredService<ISubs.IContactsEvictedHandler>();

                var result = await handler.HandleAsync(message.Body, ct);

                if (result.Failed)
                {
                    LogEventProcessingFailed(r_logger);

                    return ConsumerResult.Drop;
                }

                LogEventProcessed(r_logger, message.Body.Contacts.Count);

                return ConsumerResult.Ack;
            },
            stoppingToken);
    }

    /// <summary>
    /// Logs that a ContactsEvicted event was received.
    /// </summary>
    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Received ContactsEvicted event for {IdCount} contact(s)")]
    private static partial void LogEventReceived(ILogger logger, int idCount);

    /// <summary>
    /// Logs that processing a ContactsEvicted event failed.
    /// </summary>
    [LoggerMessage(EventId = 2, Level = LogLevel.Error, Message = "Failed to process ContactsEvicted event")]
    private static partial void LogEventProcessingFailed(ILogger logger);

    /// <summary>
    /// Logs that a ContactsEvicted event was successfully processed.
    /// </summary>
    [LoggerMessage(EventId = 3, Level = LogLevel.Information, Message = "Successfully processed ContactsEvicted event for {IdCount} contact(s)")]
    private static partial void LogEventProcessed(ILogger logger, int idCount);
}
