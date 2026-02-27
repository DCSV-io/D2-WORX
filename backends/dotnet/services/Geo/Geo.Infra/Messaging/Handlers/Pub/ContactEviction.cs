// -----------------------------------------------------------------------
// <copyright file="ContactEviction.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Messaging.Handlers.Pub;

using D2.Geo.Infra.Messaging.Publishers;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using H = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs.IContactEvictionHandler;
using I = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs.ContactEvictionInput;
using O = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs.ContactEvictionOutput;

/// <summary>
/// Handler for publishing contact eviction events.
/// </summary>
public class ContactEviction : BaseHandler<ContactEviction, I, O>, H
{
    private readonly ContactEvictionPublisher r_publisher;

    /// <summary>
    /// Initializes a new instance of the <see cref="ContactEviction"/> class.
    /// </summary>
    ///
    /// <param name="publisher">
    /// The publisher for contact eviction events.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public ContactEviction(
        ContactEvictionPublisher publisher,
        IHandlerContext context)
        : base(context)
    {
        r_publisher = publisher;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var result = await r_publisher.PublishAsync(input.Event, ct);

        if (result.Failed)
        {
            Context.Logger.LogError(
                "Failed to publish ContactsEvicted event. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.Fail(
                ["Failed to publish contact eviction notification."],
                System.Net.HttpStatusCode.InternalServerError);
        }

        Context.Logger.LogInformation(
            "Published ContactsEvicted event for {Count} contact(s). TraceId: {TraceId}",
            input.Event.Contacts.Count,
            TraceId);

        return D2Result<O?>.Ok(new O());
    }
}
