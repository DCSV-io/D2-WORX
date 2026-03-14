// -----------------------------------------------------------------------
// <copyright file="UpdatePublisher.cs" company="DCSV">
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
/// Publishes geographic reference data updated events via raw AMQP.
/// </summary>
public partial class UpdatePublisher
{
    private readonly ProtoPublisher r_publisher;
    private readonly ILogger<UpdatePublisher> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdatePublisher"/> class.
    /// </summary>
    ///
    /// <param name="publisher">
    /// The proto publisher.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    public UpdatePublisher(
        ProtoPublisher publisher,
        ILogger<UpdatePublisher> logger)
    {
        r_publisher = publisher;
        r_logger = logger;
    }

    /// <summary>
    /// Publishes a geographic reference data updated event.
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
        GeoRefDataUpdatedEvent message,
        CancellationToken ct = default)
    {
        try
        {
            await r_publisher.PublishAsync(
                AmqpConventions.EventExchange("geo"),
                message,
                ct: ct);

            LogPublishedGeoRefDataUpdated(r_logger, message.Version);

            return D2Result.Ok();
        }
        catch (Exception ex)
        {
            LogPublishGeoRefDataUpdatedFailed(r_logger, ex, message.Version);

            return D2Result.ServiceUnavailable();
        }
    }

    /// <summary>
    /// Logs that a GeoRefDataUpdated event was successfully published.
    /// </summary>
    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Successfully published GeoRefDataUpdated event for version {Version}")]
    private static partial void LogPublishedGeoRefDataUpdated(ILogger logger, string version);

    /// <summary>
    /// Logs an error when publishing a GeoRefDataUpdated event fails.
    /// </summary>
    [LoggerMessage(EventId = 2, Level = LogLevel.Error, Message = "Failed to publish GeoRefDataUpdated event for version {Version}")]
    private static partial void LogPublishGeoRefDataUpdatedFailed(ILogger logger, Exception exception, string version);
}
