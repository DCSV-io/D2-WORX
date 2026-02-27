// -----------------------------------------------------------------------
// <copyright file="ContactEvictionPublisher.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Messaging.Publishers;

using System.Net;
using D2.Events.Protos.V1;
using D2.Shared.Messaging.RabbitMQ;
using D2.Shared.Messaging.RabbitMQ.Conventions;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;

/// <summary>
/// Publishes contact eviction events via raw AMQP.
/// All geo-client instances (Node.js + .NET) subscribe to evict matching cache entries.
/// </summary>
public class ContactEvictionPublisher
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

            r_logger.LogInformation(
                "Published ContactsEvicted event for {Count} contact(s)",
                message.Contacts.Count);

            return D2Result.Ok();
        }
        catch (Exception ex)
        {
            r_logger.LogError(
                ex,
                "Failed to publish ContactsEvicted event for {Count} contact(s)",
                message.Contacts.Count);

            return D2Result.Fail(
                ["Failed to publish contact eviction event to RabbitMQ."],
                HttpStatusCode.ServiceUnavailable);
        }
    }
}
