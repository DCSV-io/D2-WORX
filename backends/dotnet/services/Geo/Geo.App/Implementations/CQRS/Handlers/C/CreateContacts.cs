// -----------------------------------------------------------------------
// <copyright file="CreateContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.C;

using D2.Shared.Handler;
using D2.Shared.Result;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.App.Mappers;
using D2.Geo.Domain.Entities;
using D2.Services.Protos.Geo.V1;
using CreateRepo = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.ICreateContactsHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.CreateContactsInput;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.CreateContactsOutput;

/// <summary>
/// Handler for creating Contacts.
/// </summary>
///
/// <remarks>
/// This handler resolves locations before creating contacts:
/// <list type="bullet">
/// <item>If <c>Location.HashId</c> is provided with no other data, use it as reference to existing location.</item>
/// <item>Else if full <c>Location</c> data is provided, extract and create the location first.</item>
/// <item>Locations are deduplicated by hash (same address = same hash).</item>
/// </list>
/// </remarks>
public class CreateContacts : BaseHandler<CreateContacts, I, O>, H
{
    private readonly CreateRepo.ICreateContactsHandler r_createContactsInRepo;
    private readonly CreateRepo.ICreateLocationsHandler r_createLocationsInRepo;
    private readonly IQueries.IGetLocationsByIdsHandler r_getLocationsByIds;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateContacts"/> class.
    /// </summary>
    ///
    /// <param name="createContactsInRepo">
    /// The repository handler for creating Contacts.
    /// </param>
    /// <param name="createLocationsInRepo">
    /// The repository handler for creating Locations.
    /// </param>
    /// <param name="getLocationsByIds">
    /// The handler for fetching locations by their IDs.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public CreateContacts(
        CreateRepo.ICreateContactsHandler createContactsInRepo,
        CreateRepo.ICreateLocationsHandler createLocationsInRepo,
        IQueries.IGetLocationsByIdsHandler getLocationsByIds,
        IHandlerContext context)
        : base(context)
    {
        r_createContactsInRepo = createContactsInRepo;
        r_createLocationsInRepo = createLocationsInRepo;
        r_getLocationsByIds = getLocationsByIds;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.Request.ContactsToCreate.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]), traceId: TraceId);
        }

        // Step 1: Resolve LocationHashIds for each contact.
        var locationHashIds = ResolveLocationHashIds(input.Request.ContactsToCreate);

        // Step 2: Extract and create unique locations (for contacts without explicit hash).
        var locationsToCreate = ExtractLocationsToCreate(input.Request.ContactsToCreate);

        if (locationsToCreate.Count > 0)
        {
            var createLocationsR = await r_createLocationsInRepo.HandleAsync(
                new CreateRepo.CreateLocationsInput(locationsToCreate),
                ct);

            if (createLocationsR.CheckFailure(out _))
            {
                return D2Result<O?>.BubbleFail(createLocationsR);
            }
        }

        // Step 3: Convert DTOs to domain entities with resolved location hash IDs.
        var contacts = new List<Contact>(input.Request.ContactsToCreate.Count);
        for (var i = 0; i < input.Request.ContactsToCreate.Count; i++)
        {
            var dto = input.Request.ContactsToCreate[i];
            contacts.Add(dto.ToDomain(locationHashIds[i]));
        }

        // Step 4: Create contacts in repository.
        var repoR = await r_createContactsInRepo.HandleAsync(new(contacts), ct);

        if (repoR.CheckFailure(out _))
        {
            return D2Result<O?>.BubbleFail(repoR);
        }

        // Step 5: Fetch locations for the response.
        var locationDict = await FetchLocationsAsync(contacts, ct);

        // Step 6: Return the created contacts as DTOs with locations.
        var contactDTOs = contacts.Select(c => c.ToDTO(
            c.LocationHashId is not null && locationDict.TryGetValue(c.LocationHashId, out var loc)
                ? loc
                : null)).ToList();
        return D2Result<O?>.Ok(new O(contactDTOs), traceId: TraceId);
    }

    /// <summary>
    /// Resolves the location hash ID for each contact in the request.
    /// If full location data is provided, computes hash from that. Otherwise, uses explicit
    /// hash ID.
    /// </summary>
    private static List<string?> ResolveLocationHashIds(
        IReadOnlyList<ContactToCreateDTO> contactDTOs) =>
        contactDTOs
            .Select(dto => dto.ExtractLocation()?.HashId ?? dto.GetLocationHashId())
            .ToList();

    /// <summary>
    /// Extracts unique locations that need to be created from contacts
    /// that have full location data provided.
    /// </summary>
    private static List<Location> ExtractLocationsToCreate(
        IReadOnlyList<ContactToCreateDTO> contactDTOs) =>
        contactDTOs
            .Select(dto => dto.ExtractLocation())
            .OfType<Location>()
            .DistinctBy(l => l.HashId)
            .ToList();

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

        // Return whatever we got (even on SOME_FOUND).
        return locationsR.Data?.Data ?? [];
    }
}
