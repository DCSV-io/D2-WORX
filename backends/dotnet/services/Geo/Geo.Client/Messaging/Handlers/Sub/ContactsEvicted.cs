// -----------------------------------------------------------------------
// <copyright file="ContactsEvicted.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Messaging.Handlers.Sub;

using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.D;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using H = D2.Geo.Client.Interfaces.Messaging.Handlers.Sub.ISubs.IContactsEvictedHandler;
using I = D2.Events.Protos.V1.ContactsEvictedEvent;
using O = D2.Geo.Client.Interfaces.Messaging.Handlers.Sub.ISubs.ContactsEvictedOutput;

/// <summary>
/// Messaging subscription handler for contact eviction notifications.
/// Evicts matching entries from the local in-memory cache.
/// </summary>
public class ContactsEvicted : BaseHandler<ContactsEvicted, I, O>, H
{
    private readonly IDelete.IRemoveHandler r_cacheRemove;

    /// <summary>
    /// Initializes a new instance of the <see cref="ContactsEvicted"/> class.
    /// </summary>
    ///
    /// <param name="cacheRemove">
    /// The in-memory cache remove handler.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public ContactsEvicted(
        IDelete.IRemoveHandler cacheRemove,
        IHandlerContext context)
        : base(context)
    {
        r_cacheRemove = cacheRemove;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        foreach (var contact in input.Contacts)
        {
            // Evict by contact ID.
            var removeByIdR = await r_cacheRemove.HandleAsync(
                new($"GetContactsByIds:{contact.ContactId}"), ct);

            if (removeByIdR.Failed)
            {
                Context.Logger.LogWarning(
                    "Failed to evict contact {ContactId} from cache. TraceId: {TraceId}",
                    contact.ContactId,
                    TraceId);
            }

            // Evict by ext-key.
            var removeByExtR = await r_cacheRemove.HandleAsync(
                new($"contact-ext:{contact.ContextKey}:{contact.RelatedEntityId}"), ct);

            if (removeByExtR.Failed)
            {
                Context.Logger.LogWarning(
                    "Failed to evict contact-ext:{ContextKey}:{RelatedEntityId} from cache. TraceId: {TraceId}",
                    contact.ContextKey,
                    contact.RelatedEntityId,
                    TraceId);
            }
        }

        Context.Logger.LogInformation(
            "Evicted {Count} contact(s) (by ID + ext-key) from cache. TraceId: {TraceId}",
            input.Contacts.Count,
            TraceId);

        return D2Result<O?>.Ok(new O());
    }
}
