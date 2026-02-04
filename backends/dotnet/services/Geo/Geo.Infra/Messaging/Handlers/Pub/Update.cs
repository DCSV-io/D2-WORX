// -----------------------------------------------------------------------
// <copyright file="Update.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Messaging.Handlers.Pub;

using D2.Contracts.Handler;
using D2.Contracts.Messages.Geo;
using D2.Contracts.Result;
using D2.Geo.Infra.Messaging.MT.Publishers;
using Microsoft.Extensions.Logging;
using H = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs.IUpdateHandler;
using I = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs.UpdateInput;
using O = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs.UpdateOutput;

/// <summary>
/// Handler for publishing geographic reference data update notifications.
/// </summary>
public class Update : BaseHandler<Update, I, O>, H
{
    private readonly UpdatePublisher r_publisher;

    /// <summary>
    /// Initializes a new instance of the <see cref="Update"/> class.
    /// </summary>
    ///
    /// <param name="publisher">
    /// The MassTransit publisher for geographic reference data updates.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Update(
        UpdatePublisher publisher,
        IHandlerContext context)
        : base(context)
    {
        r_publisher = publisher;
    }

    /// <summary>
    /// Executes the handler to publish a geographic reference data update notification.
    /// </summary>
    ///
    /// <param name="input">
    /// The input containing the version to publish.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> containing a <see cref="D2Result{O}"/> indicating success or
    /// failure.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var message = new GeoRefDataUpdated(input.Version);

        var result = await r_publisher.PublishAsync(message, ct);

        if (result.Failed)
        {
            Context.Logger.LogError(
                "Failed to publish GeoRefDataUpdated message for version {Version}. TraceId: {TraceId}",
                input.Version,
                TraceId);

            return D2Result<O?>.Fail(
                ["Failed to publish update notification."],
                System.Net.HttpStatusCode.InternalServerError,
                traceId: TraceId);
        }

        Context.Logger.LogInformation(
            "Published GeoRefDataUpdated message for version {Version}. TraceId: {TraceId}",
            input.Version,
            TraceId);

        return D2Result<O?>.Ok(new O(), traceId: TraceId);
    }
}
