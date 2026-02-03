// -----------------------------------------------------------------------
// <copyright file="CreateContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.C;

using D2.Contracts.Handler;
using D2.Contracts.Result;
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
/// <item>If <c>location_hash_id</c> is provided, use it directly.</item>
/// <item>Else if <c>location_to_create</c> is provided, extract and create the location first.</item>
/// <item>Locations are deduplicated by hash (same address = same hash).</item>
/// </list>
/// </remarks>
public class CreateContacts : BaseHandler<CreateContacts, I, O>, H
{
    private readonly CreateRepo.ICreateContactsHandler r_createContactsInRepo;
    private readonly CreateRepo.ICreateLocationsHandler r_createLocationsInRepo;

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
    /// <param name="context">
    /// The handler context.
    /// </param>
    public CreateContacts(
        CreateRepo.ICreateContactsHandler createContactsInRepo,
        CreateRepo.ICreateLocationsHandler createLocationsInRepo,
        IHandlerContext context)
        : base(context)
    {
        r_createContactsInRepo = createContactsInRepo;
        r_createLocationsInRepo = createLocationsInRepo;
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

        // Step 5: Return the created contacts as DTOs.
        var dtos = contacts.Select(c => c.ToDTO()).ToList();
        return D2Result<O?>.Ok(new O(dtos), traceId: TraceId);
    }

    /// <summary>
    /// Resolves the location hash ID for each contact in the request.
    /// Priority: explicit location_hash_id > computed from location_to_create > null.
    /// </summary>
    private static List<string?> ResolveLocationHashIds(
        IReadOnlyList<ContactToCreateDTO> contactDtos)
    {
        var result = new List<string?>(contactDtos.Count);

        foreach (var dto in contactDtos)
        {
            // Priority 1: Explicit location_hash_id.
            var explicitHashId = dto.GetExplicitLocationHashId();
            if (explicitHashId is not null)
            {
                result.Add(explicitHashId);
                continue;
            }

            // Priority 2: Compute from embedded location_to_create.
            var location = dto.ExtractLocation();
            if (location is not null)
            {
                result.Add(location.HashId);
                continue;
            }

            // No location data.
            result.Add(null);
        }

        return result;
    }

    /// <summary>
    /// Extracts unique locations that need to be created from contacts
    /// that don't have an explicit location_hash_id.
    /// </summary>
    private static List<Location> ExtractLocationsToCreate(
        IReadOnlyList<ContactToCreateDTO> contactDtos)
    {
        var uniqueLocations = new Dictionary<string, Location>();

        foreach (var dto in contactDtos)
        {
            // Skip if explicit hash ID was provided (don't create location).
            if (dto.GetExplicitLocationHashId() is not null)
            {
                continue;
            }

            // Skip if no location to create.
            var location = dto.ExtractLocation();
            if (location is null)
            {
                continue;
            }

            // Deduplicate by hash ID (same address = same hash).
            uniqueLocations.TryAdd(location.HashId, location);
        }

        return [.. uniqueLocations.Values];
    }
}
