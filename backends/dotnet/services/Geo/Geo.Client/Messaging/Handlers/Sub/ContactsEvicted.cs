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
public partial class ContactsEvicted : BaseHandler<ContactsEvicted, I, O>, H
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
                new(CacheKeys.Contact(Guid.Parse(contact.ContactId))), ct);

            if (removeByIdR.Failed)
            {
                LogContactEvictionFailed(Context.Logger, contact.ContactId, TraceId);
            }

            // Evict by ext-key.
            var removeByExtR = await r_cacheRemove.HandleAsync(
                new(CacheKeys.ContactsByExtKey(contact.ContextKey, Guid.Parse(contact.RelatedEntityId))), ct);

            if (removeByExtR.Failed)
            {
                LogExtKeyEvictionFailed(Context.Logger, contact.ContextKey, contact.RelatedEntityId, TraceId);
            }
        }

        LogContactsEvicted(Context.Logger, input.Contacts.Count, TraceId);

        return D2Result<O?>.Ok(new O());
    }

    /// <summary>
    /// Logs a warning when evicting a contact by ID from the cache fails.
    /// </summary>
    [LoggerMessage(EventId = 1, Level = LogLevel.Warning, Message = "Failed to evict contact {ContactId} from cache. TraceId: {TraceId}")]
    private static partial void LogContactEvictionFailed(ILogger logger, string contactId, string? traceId);

    /// <summary>
    /// Logs a warning when evicting a contacts-by-extkey entry from the cache fails.
    /// </summary>
    [LoggerMessage(EventId = 2, Level = LogLevel.Warning, Message = "Failed to evict geo:contacts-by-extkey:{ContextKey}:{RelatedEntityId} from cache. TraceId: {TraceId}")]
    private static partial void LogExtKeyEvictionFailed(ILogger logger, string contextKey, string relatedEntityId, string? traceId);

    /// <summary>
    /// Logs that contacts were successfully evicted from the cache.
    /// </summary>
    [LoggerMessage(EventId = 3, Level = LogLevel.Information, Message = "Evicted {Count} contact(s) (by ID + ext-key) from cache. TraceId: {TraceId}")]
    private static partial void LogContactsEvicted(ILogger logger, int count, string? traceId);
}
