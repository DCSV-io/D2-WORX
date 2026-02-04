// -----------------------------------------------------------------------
// <copyright file="GetContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.Q;

using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.App.Mappers;
using D2.Geo.Domain.Entities;
using D2.Services.Protos.Geo.V1;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries.IGetContactsByExtKeysHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries.GetContactsByExtKeysInput;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries.GetContactsByExtKeysOutput;
using ReadRepo = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead;

/// <summary>
/// Handler for getting Contacts by their external keys (ContextKey + RelatedEntityId).
/// </summary>
///
/// <remarks>
/// This handler does not use caching since external key lookups are less common
/// and the results can vary (multiple contacts per key). Direct repository access is used.
/// </remarks>
public class GetContactsByExtKeys : BaseHandler<GetContactsByExtKeys, I, O>, H
{
    private readonly ReadRepo.IGetContactsByExtKeysHandler r_getContactsFromRepo;
    private readonly IQueries.IGetLocationsByIdsHandler r_getLocationsByIds;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetContactsByExtKeys"/> class.
    /// </summary>
    ///
    /// <param name="getContactsFromRepo">
    /// The repository handler for getting Contacts by external keys.
    /// </param>
    /// <param name="getLocationsByIds">
    /// The handler for fetching locations by their IDs.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public GetContactsByExtKeys(
        ReadRepo.IGetContactsByExtKeysHandler getContactsFromRepo,
        IQueries.IGetLocationsByIdsHandler getLocationsByIds,
        IHandlerContext context)
        : base(context)
    {
        r_getContactsFromRepo = getContactsFromRepo;
        r_getLocationsByIds = getLocationsByIds;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.Request.Keys.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]), traceId: TraceId);
        }

        // Convert proto keys to domain tuples.
        var extKeys = input.Request.Keys
            .Select(k => (k.ContextKey, Guid.TryParse(k.RelatedEntityId, out var g) ? g : Guid.Empty))
            .Where(t => t.Item2 != Guid.Empty)
            .ToList();

        if (extKeys.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]), traceId: TraceId);
        }

        // Fetch from repository.
        var repoR = await r_getContactsFromRepo.HandleAsync(new(extKeys), ct);

        // If that succeeded, convert and return.
        if (repoR.CheckSuccess(out var repoOutput))
        {
            var result = await ConvertToProtoDictAsync(repoOutput!.Contacts, ct);
            return D2Result<O?>.Ok(new O(result), traceId: TraceId);
        }

        // Handle specific error codes.
        switch (repoR.ErrorCode)
        {
            case ErrorCodes.NOT_FOUND:
                return D2Result<O?>.NotFound(traceId: TraceId);

            case ErrorCodes.SOME_FOUND:
            {
                var result = await ConvertToProtoDictAsync(repoOutput!.Contacts, ct);
                return D2Result<O?>.SomeFound(new O(result), traceId: TraceId);
            }

            default:
                return D2Result<O?>.BubbleFail(repoR);
        }
    }

    private static Location? GetLocation(string? hashId, Dictionary<string, Location> locations) =>
        hashId is not null && locations.TryGetValue(hashId, out var loc) ? loc : null;

    private async ValueTask<Dictionary<GetContactsExtKeys, List<ContactDTO>>> ConvertToProtoDictAsync(
        Dictionary<(string ContextKey, Guid RelatedEntityId), List<Contact>> source,
        CancellationToken ct)
    {
        // Collect all contacts from all keys.
        var allContacts = source.Values.SelectMany(list => list).ToList();

        // Fetch all locations.
        var locations = await FetchLocationsAsync(allContacts, ct);

        return source.ToDictionary(
            kvp => new GetContactsExtKeys
            {
                ContextKey = kvp.Key.ContextKey,
                RelatedEntityId = kvp.Key.RelatedEntityId.ToString(),
            },
            kvp => kvp.Value.Select(c => c.ToDTO(GetLocation(c.LocationHashId, locations))).ToList());
    }

    private async ValueTask<Dictionary<string, Location>> FetchLocationsAsync(
        IEnumerable<Contact> contacts,
        CancellationToken ct)
    {
        var locationHashIds = contacts
            .Where(c => c.LocationHashId is not null)
            .Select(c => c.LocationHashId!)
            .Distinct()
            .ToList();

        if (locationHashIds.Count == 0)
        {
            return [];
        }

        var locationsR = await r_getLocationsByIds.HandleAsync(
            new IQueries.GetLocationsByIdsInput(locationHashIds),
            ct);

        return locationsR.Data?.Data ?? [];
    }
}
