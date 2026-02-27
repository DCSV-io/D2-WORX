// -----------------------------------------------------------------------
// <copyright file="DeleteContactsByExtKeys.cs" company="DCSV">
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
using H = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.IDeleteContactsByExtKeysHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.DeleteContactsByExtKeysInput;
using IPubs = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.DeleteContactsByExtKeysOutput;
using ReadRepo = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead;

/// <summary>
/// Handler for deleting Contacts by their external keys (ContextKey + RelatedEntityId).
/// </summary>
public class DeleteContactsByExtKeys : BaseHandler<DeleteContactsByExtKeys, I, O>, H
{
    private readonly ReadRepo.IGetContactsByExtKeysHandler r_getByExtKeys;
    private readonly DeleteRepo.IDeleteContactsByExtKeysHandler r_deleteFromRepo;
    private readonly IDelete.IRemoveHandler r_memoryCacheRemove;
    private readonly IPubs.IContactEvictionHandler r_evictionHandler;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteContactsByExtKeys"/> class.
    /// </summary>
    ///
    /// <param name="getByExtKeys">
    /// The repository handler for reading Contacts by ext-keys (to capture data before deletion).
    /// </param>
    /// <param name="deleteFromRepo">
    /// The repository handler for deleting Contacts by external keys.
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
    public DeleteContactsByExtKeys(
        ReadRepo.IGetContactsByExtKeysHandler getByExtKeys,
        DeleteRepo.IDeleteContactsByExtKeysHandler deleteFromRepo,
        IDelete.IRemoveHandler memoryCacheRemove,
        IPubs.IContactEvictionHandler evictionHandler,
        IHandlerContext context)
        : base(context)
    {
        r_getByExtKeys = getByExtKeys;
        r_deleteFromRepo = deleteFromRepo;
        r_memoryCacheRemove = memoryCacheRemove;
        r_evictionHandler = evictionHandler;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.Keys.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0));
        }

        // Validate: no empty GUIDs or blank context keys.
        List<List<string>> allErrors = [];
        for (var i = 0; i < input.Keys.Count; i++)
        {
            var (contextKey, relatedEntityId) = input.Keys[i];

            if (string.IsNullOrWhiteSpace(contextKey))
            {
                allErrors.Add([$"keys[{i}].contextKey", "Context key must not be empty."]);
            }

            if (relatedEntityId == Guid.Empty)
            {
                allErrors.Add([$"keys[{i}].relatedEntityId", "Related entity ID must not be an empty GUID."]);
            }
        }

        if (allErrors.Count > 0)
        {
            return D2Result<O?>.BubbleFail(
                D2Result.ValidationFailed(inputErrors: allErrors));
        }

        // Read contacts before deletion to capture data for eviction event.
        var getR = await r_getByExtKeys.HandleAsync(new(input.Keys), ct);
        var foundContacts = getR.Data?.Contacts ?? [];

        // Delete from repository.
        var repoR = await r_deleteFromRepo.HandleAsync(new(input.Keys), ct);

        if (repoR.CheckFailure(out var repoOutput))
        {
            return D2Result<O?>.BubbleFail(repoR);
        }

        // Invalidate local cache for deleted contacts.
        foreach (var id in repoOutput!.DeletedIds)
        {
            var removeR = await r_memoryCacheRemove.HandleAsync(
                new(ClientCacheKeys.Contact(id)), ct);

            if (removeR.Failed)
            {
                Context.Logger.LogWarning(
                    "Failed to remove Contact {ContactId} from memory cache after ext-key delete. TraceId: {TraceId}.",
                    id,
                    TraceId);
            }
        }

        // Publish eviction event for cross-service cache invalidation.
        if (foundContacts.Count > 0)
        {
            var evictionEvent = new ContactsEvictedEvent();
            evictionEvent.Contacts.AddRange(
                foundContacts.SelectMany(kvp => kvp.Value.Select(c => new EvictedContact
                {
                    ContactId = c.Id.ToString(),
                    ContextKey = c.ContextKey,
                    RelatedEntityId = c.RelatedEntityId.ToString(),
                })));
            await r_evictionHandler.HandleAsync(new IPubs.ContactEvictionInput(evictionEvent), ct);
        }

        return D2Result<O?>.Ok(new O(repoOutput.Deleted));
    }
}
