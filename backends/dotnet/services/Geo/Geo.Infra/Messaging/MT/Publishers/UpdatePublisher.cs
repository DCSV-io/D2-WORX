// -----------------------------------------------------------------------
// <copyright file="UpdatePublisher.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Messaging.MT.Publishers;

using System.Net;
using D2.Geo.Client.Messages;
using D2.Shared.Result;
using MassTransit;
using Microsoft.Extensions.Logging;

/// <summary>
/// MassTransit publisher for geographic reference data updated messages.
/// </summary>
public class UpdatePublisher
{
    private readonly IPublishEndpoint r_publishEndpoint;
    private readonly ILogger<UpdatePublisher> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdatePublisher"/> class.
    /// </summary>
    ///
    /// <param name="publishEndpoint">
    /// The MassTransit publish endpoint.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    public UpdatePublisher(
        IPublishEndpoint publishEndpoint,
        ILogger<UpdatePublisher> logger)
    {
        r_publishEndpoint = publishEndpoint;
        r_logger = logger;
    }

    /// <summary>
    /// Publishes a geographic reference data updated message.
    /// </summary>
    ///
    /// <param name="message">
    /// The message to publish.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> containing a <see cref="D2Result"/> indicating success or failure.
    /// </returns>
    public virtual async Task<D2Result> PublishAsync(
        GeoRefDataUpdated message,
        CancellationToken ct = default)
    {
        try
        {
            await r_publishEndpoint.Publish(message, ct);

            r_logger.LogInformation(
                "Successfully published GeoRefDataUpdated message for version {Version}",
                message.Version);

            return D2Result.Ok();
        }
        catch (Exception ex)
        {
            r_logger.LogError(
                ex,
                "Failed to publish GeoRefDataUpdated message for version {Version}",
                message.Version);

            return D2Result.Fail(
                ["Failed to publish message to RabbitMQ."],
                HttpStatusCode.ServiceUnavailable);
        }
    }
}
