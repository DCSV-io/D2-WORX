// -----------------------------------------------------------------------
// <copyright file="DeleteContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.C;

using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.D;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using DeleteRepo = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.IDeleteContactsHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.DeleteContactsInput;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.DeleteContactsOutput;

/// <summary>
/// Handler for deleting Contacts.
/// </summary>
public class DeleteContacts : BaseHandler<DeleteContacts, I, O>, H
{
    private readonly DeleteRepo.IDeleteContactsHandler r_deleteContactsFromRepo;
    private readonly IDelete.IRemoveHandler r_memoryCacheRemove;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteContacts"/> class.
    /// </summary>
    ///
    /// <param name="deleteContactsFromRepo">
    /// The repository handler for deleting Contacts.
    /// </param>
    /// <param name="memoryCacheRemove">
    /// The in-memory cache remove handler.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public DeleteContacts(
        DeleteRepo.IDeleteContactsHandler deleteContactsFromRepo,
        IDelete.IRemoveHandler memoryCacheRemove,
        IHandlerContext context)
        : base(context)
    {
        r_deleteContactsFromRepo = deleteContactsFromRepo;
        r_memoryCacheRemove = memoryCacheRemove;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.ContactIds.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0), traceId: TraceId);
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
                D2Result.ValidationFailed(inputErrors: allErrors, traceId: TraceId));
        }

        // Delete from repository.
        var repoR = await r_deleteContactsFromRepo.HandleAsync(
            new(input.ContactIds), ct);

        if (repoR.CheckFailure(out var repoOutput))
        {
            return D2Result<O?>.BubbleFail(repoR);
        }

        // Invalidate cache for deleted contacts.
        foreach (var id in input.ContactIds)
        {
            var removeR = await r_memoryCacheRemove.HandleAsync(
                new(GetCacheKey(id)), ct);

            if (removeR.Failed)
            {
                Context.Logger.LogWarning(
                    "Failed to remove Contact {ContactId} from memory cache after delete. TraceId: {TraceId}.",
                    id,
                    TraceId);
            }
        }

        return D2Result<O?>.Ok(new O(repoOutput!.Deleted), traceId: TraceId);
    }

    private static string GetCacheKey(Guid id) => $"GetContactsByIds:{id}";
}
