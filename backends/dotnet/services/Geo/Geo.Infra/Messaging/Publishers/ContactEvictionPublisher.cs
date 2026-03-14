// -----------------------------------------------------------------------
// <copyright file="ContactEvictionPublisher.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Messaging.Publishers;

using D2.Events.Protos.V1;
using D2.Shared.Messaging.RabbitMQ;
using D2.Shared.Messaging.RabbitMQ.Conventions;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;

/// <summary>
/// Publishes contact eviction events via raw AMQP.
/// All geo-client instances (Node.js + .NET) subscribe to evict matching cache entries.
/// </summary>
public partial class ContactEvictionPublisher
{
    private readonly ProtoPublisher r_publisher;
    private readonly ILogger<ContactEvictionPublisher> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="ContactEvictionPublisher"/> class.
    /// </summary>
    ///
    /// <param name="publisher">
    /// The proto publisher.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    public ContactEvictionPublisher(
        ProtoPublisher publisher,
        ILogger<ContactEvictionPublisher> logger)
    {
        r_publisher = publisher;
        r_logger = logger;
    }

    /// <summary>
    /// Publishes a contacts evicted event.
    /// </summary>
    ///
    /// <param name="message">
    /// The event to publish.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> containing a <see cref="D2Result"/> indicating success or failure.
    /// </returns>
    public virtual async Task<D2Result> PublishAsync(
        ContactsEvictedEvent message,
        CancellationToken ct = default)
    {
        try
        {
            await r_publisher.PublishAsync(
                AmqpConventions.EventExchange("geo.contacts"),
                message,
                ct: ct);

            LogPublishedContactsEvicted(r_logger, message.Contacts.Count);

            return D2Result.Ok();
        }
        catch (Exception ex)
        {
            LogPublishContactsEvictedFailed(r_logger, ex, message.Contacts.Count);

            return D2Result.ServiceUnavailable();
        }
    }

    /// <summary>
    /// Logs that a ContactsEvicted event was successfully published.
    /// </summary>
    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Published ContactsEvicted event for {Count} contact(s)")]
    private static partial void LogPublishedContactsEvicted(ILogger logger, int count);

    /// <summary>
    /// Logs an error when publishing a ContactsEvicted event fails.
    /// </summary>
    [LoggerMessage(EventId = 2, Level = LogLevel.Error, Message = "Failed to publish ContactsEvicted event for {Count} contact(s)")]
    private static partial void LogPublishContactsEvictedFailed(ILogger logger, Exception exception, int count);
}
