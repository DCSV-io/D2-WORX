// -----------------------------------------------------------------------
// <copyright file="UpdatedConsumer.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Messaging.MT.Consumers;

using D2.Geo.Client.Interfaces.Messaging.Handlers.Sub;
using D2.Geo.Client.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

/// <summary>
/// MassTransit consumer for geographic reference data updated messages.
/// </summary>
public class UpdatedConsumer : IConsumer<GeoRefDataUpdated>
{
    private readonly ISubs.IUpdatedHandler r_handler;
    private readonly ILogger<UpdatedConsumer> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdatedConsumer"/> class.
    /// </summary>
    ///
    /// <param name="handler">
    /// The updated handler.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    public UpdatedConsumer(
        ISubs.IUpdatedHandler handler,
        ILogger<UpdatedConsumer> logger)
    {
        r_handler = handler;
        r_logger = logger;
    }

    /// <summary>
    /// Consumes the geographic reference data updated message.
    /// </summary>
    ///
    /// <param name="context">
    /// The consume context containing the message.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    public async Task Consume(ConsumeContext<GeoRefDataUpdated> context)
    {
        var message = context.Message;

        r_logger.LogInformation(
            "Received GeoRefDataUpdated message for version {Version}",
            message.Version);

        var result = await r_handler.HandleAsync(message, context.CancellationToken);

        if (result.Failed)
        {
            r_logger.LogError(
                "Failed to process GeoRefDataUpdated message for version {Version}",
                message.Version);

            // Throw to trigger MassTransit retry/error handling.
            throw new InvalidOperationException(
                $"Failed to process GeoRefDataUpdated message for version {message.Version}");
        }

        r_logger.LogInformation(
            "Successfully processed GeoRefDataUpdated message for version {Version}",
            message.Version);
    }
}
