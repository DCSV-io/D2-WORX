// -----------------------------------------------------------------------
// <copyright file="DeleteContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.C;

using D2.Events.Protos.V1;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.D;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using ClientCacheKeys = D2.Geo.Client.CacheKeys;
using DeleteRepo = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.IDeleteContactsHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.DeleteContactsInput;
using IPubs = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.DeleteContactsOutput;
using ReadRepo = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead;

/// <summary>
/// Handler for deleting Contacts.
/// </summary>
public class DeleteContacts : BaseHandler<DeleteContacts, I, O>, H
{
    private readonly ReadRepo.IGetContactsByIdsHandler r_getContactsByIds;
    private readonly DeleteRepo.IDeleteContactsHandler r_deleteContactsFromRepo;
    private readonly IDelete.IRemoveHandler r_memoryCacheRemove;
    private readonly IPubs.IContactEvictionHandler r_evictionHandler;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteContacts"/> class.
    /// </summary>
    ///
    /// <param name="getContactsByIds">
    /// The repository handler for getting Contacts by IDs (to read ext-keys before deletion).
    /// </param>
    /// <param name="deleteContactsFromRepo">
    /// The repository handler for deleting Contacts.
    /// </param>
    /// <param name="memoryCacheRemove">
    /// The in-memory cache remove handler.
    /// </param>
    /// <param name="evictionHandler">
    /// The handler for publishing contact eviction events.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public DeleteContacts(
        ReadRepo.IGetContactsByIdsHandler getContactsByIds,
        DeleteRepo.IDeleteContactsHandler deleteContactsFromRepo,
        IDelete.IRemoveHandler memoryCacheRemove,
        IPubs.IContactEvictionHandler evictionHandler,
        IHandlerContext context)
        : base(context)
    {
        r_getContactsByIds = getContactsByIds;
        r_deleteContactsFromRepo = deleteContactsFromRepo;
        r_memoryCacheRemove = memoryCacheRemove;
        r_evictionHandler = evictionHandler;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.ContactIds.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0));
        }

        // Validate: no empty GUIDs.
        List<List<string>> allErrors = [];
        for (var i = 0; i < input.ContactIds.Count; i++)
        {
            if (input.ContactIds[i] == Guid.Empty)
            {
                allErrors.Add([$"items[{i}]", "Contact ID must not be an empty GUID."]);
            }
        }

        if (allErrors.Count > 0)
        {
            return D2Result<O?>.BubbleFail(
                D2Result.ValidationFailed(inputErrors: allErrors));
        }

        // Read contacts first to capture ext-keys before deletion.
        var getR = await r_getContactsByIds.HandleAsync(new(input.ContactIds), ct);
        var foundContacts = getR.Data?.Contacts ?? [];

        // Delete from repository.
        var repoR = await r_deleteContactsFromRepo.HandleAsync(
            new(input.ContactIds), ct);

        if (repoR.CheckFailure(out var repoOutput))
        {
            return D2Result<O?>.BubbleFail(repoR);
        }

        // Invalidate local cache for deleted contacts.
        foreach (var id in input.ContactIds)
        {
            var removeR = await r_memoryCacheRemove.HandleAsync(
                new(ClientCacheKeys.Contact(id)), ct);

            if (removeR.Failed)
            {
                Context.Logger.LogWarning(
                    "Failed to remove Contact {ContactId} from memory cache after delete. TraceId: {TraceId}.",
                    id,
                    TraceId);
            }
        }

        // Publish eviction event for cross-service cache invalidation.
        if (foundContacts.Count > 0)
        {
            var evictionEvent = new ContactsEvictedEvent();
            evictionEvent.Contacts.AddRange(foundContacts.Values.Select(c => new EvictedContact
            {
                ContactId = c.Id.ToString(),
                ContextKey = c.ContextKey,
                RelatedEntityId = c.RelatedEntityId.ToString(),
            }));
            await r_evictionHandler.HandleAsync(new IPubs.ContactEvictionInput(evictionEvent), ct);
        }

        return D2Result<O?>.Ok(new O(repoOutput!.Deleted));
    }
}
