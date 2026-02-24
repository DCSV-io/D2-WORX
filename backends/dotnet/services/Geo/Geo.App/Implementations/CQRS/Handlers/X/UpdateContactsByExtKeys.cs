// -----------------------------------------------------------------------
// <copyright file="UpdateContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.X;

using D2.Events.Protos.V1;
using D2.Geo.Domain.Entities;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Result;
using DeleteRepo = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.X.IComplex.IUpdateContactsByExtKeysHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.X.IComplex.UpdateContactsByExtKeysInput;
using ICommands = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands;
using IPubs = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.X.IComplex.UpdateContactsByExtKeysOutput;
using ReadRepo = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead;

/// <summary>
/// Complex handler for replacing Contacts at given external keys.
/// Composes existing handlers: read → delete → create → build replacement mappings.
/// </summary>
public class UpdateContactsByExtKeys : BaseHandler<UpdateContactsByExtKeys, I, O>, H
{
    private readonly ReadRepo.IGetContactsByExtKeysHandler r_getContactsByExtKeys;
    private readonly DeleteRepo.IDeleteContactsHandler r_deleteContacts;
    private readonly ICommands.ICreateContactsHandler r_createContacts;
    private readonly IPubs.IContactEvictionHandler r_evictionHandler;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdateContactsByExtKeys"/> class.
    /// </summary>
    ///
    /// <param name="getContactsByExtKeys">
    /// The repository handler for getting contacts by external keys.
    /// </param>
    /// <param name="deleteContacts">
    /// The repository handler for deleting contacts by IDs.
    /// </param>
    /// <param name="createContacts">
    /// The app handler for creating contacts (handles location resolution).
    /// </param>
    /// <param name="evictionHandler">
    /// The handler for publishing contact eviction events.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public UpdateContactsByExtKeys(
        ReadRepo.IGetContactsByExtKeysHandler getContactsByExtKeys,
        DeleteRepo.IDeleteContactsHandler deleteContacts,
        ICommands.ICreateContactsHandler createContacts,
        IPubs.IContactEvictionHandler evictionHandler,
        IHandlerContext context)
        : base(context)
    {
        r_getContactsByExtKeys = getContactsByExtKeys;
        r_deleteContacts = deleteContacts;
        r_createContacts = createContacts;
        r_evictionHandler = evictionHandler;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.Request.Contacts.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]));
        }

        // Step 1: Extract ext-keys from the input contacts.
        var allExtKeys = input.Request.Contacts
            .Select(c => (ContextKey: c.ContextKey, RelatedEntityId: Guid.TryParse(c.RelatedEntityId, out var g) ? g : Guid.Empty))
            .Where(t => t.RelatedEntityId != Guid.Empty)
            .ToList();

        var extKeys = allExtKeys.Distinct().ToList();

        if (extKeys.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]));
        }

        // Validate: no duplicate ext-keys (each ext-key must map to exactly one new contact).
        if (allExtKeys.Count != extKeys.Count)
        {
            return D2Result<O?>.BubbleFail(
                D2Result.ValidationFailed(inputErrors:
                [
                    ["contacts", "Duplicate ext-keys (ContextKey + RelatedEntityId) are not allowed. Each ext-key must appear at most once."],
                ]));
        }

        // Step 2: Look up existing contacts by ext-keys.
        var getR = await r_getContactsByExtKeys.HandleAsync(new(extKeys), ct);

        // Build old contacts map (may be empty if NOT_FOUND — that's fine, we still create new ones).
        var oldContactsByKey = new Dictionary<(string ContextKey, Guid RelatedEntityId), List<Contact>>();
        if (getR.Data?.Contacts is not null)
        {
            oldContactsByKey = getR.Data.Contacts;
        }

        // Step 3: Delete existing contacts.
        var allOldIds = oldContactsByKey.Values.SelectMany(list => list.Select(c => c.Id)).ToList();
        if (allOldIds.Count > 0)
        {
            var deleteR = await r_deleteContacts.HandleAsync(new(allOldIds), ct);
            if (deleteR.Failed)
            {
                return D2Result<O?>.BubbleFail(deleteR);
            }
        }

        // Step 4: Create new contacts.
        var createRequest = new CreateContactsRequest();
        createRequest.ContactsToCreate.AddRange(input.Request.Contacts);

        var createR = await r_createContacts.HandleAsync(
            new ICommands.CreateContactsInput(createRequest), ct);

        if (createR.CheckFailure(out var createOutput))
        {
            return D2Result<O?>.BubbleFail(createR);
        }

        var newContacts = createOutput!.Data;

        // Step 5: Build replacement mappings.
        // For each ext-key, pair each old contact with the new ContactDTO that has the same ext-key.
        var newContactsByKey = newContacts
            .Where(c => Guid.TryParse(c.RelatedEntityId, out _))
            .GroupBy(c => (c.ContextKey, Guid.Parse(c.RelatedEntityId)))
            .ToDictionary(g => g.Key, g => g.First());

        var replacements = new List<D2.Geo.App.Interfaces.CQRS.Handlers.X.IComplex.ContactReplacementItem>();

        foreach (var (key, oldContacts) in oldContactsByKey)
        {
            if (!newContactsByKey.TryGetValue(key, out var newContactDto))
            {
                continue;
            }

            foreach (var oldContact in oldContacts)
            {
                replacements.Add(new(
                    key.ContextKey,
                    key.RelatedEntityId,
                    oldContact.Id,
                    newContactDto));
            }
        }

        // Publish eviction event for cross-service cache invalidation.
        if (allOldIds.Count > 0)
        {
            var evictionEvent = new ContactsEvictedEvent();
            evictionEvent.Contacts.AddRange(
                oldContactsByKey.SelectMany(kvp => kvp.Value.Select(c => new EvictedContact
                {
                    ContactId = c.Id.ToString(),
                    ContextKey = c.ContextKey,
                    RelatedEntityId = c.RelatedEntityId.ToString(),
                })));
            await r_evictionHandler.HandleAsync(new IPubs.ContactEvictionInput(evictionEvent), ct);
        }

        return D2Result<O?>.Ok(new O(replacements));
    }
}
