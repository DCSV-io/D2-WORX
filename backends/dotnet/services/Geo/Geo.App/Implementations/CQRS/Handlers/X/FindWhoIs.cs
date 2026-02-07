// -----------------------------------------------------------------------
// <copyright file="FindWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.X;

using D2.Geo.App.Mappers;
using D2.Geo.Domain.Entities;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using CreateRepo = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.X.IComplex.IFindWhoIsHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.X.IComplex.FindWhoIsInput;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.X.IComplex.FindWhoIsOutput;
using Queries = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries;
using WhoIsProvider = D2.Geo.App.Interfaces.WhoIs.Handlers.R.IRead;

/// <summary>
/// Handler for finding WhoIs information.
/// </summary>
///
/// <remarks>
/// <para>
/// This handler resolves WhoIs records for IP + fingerprint pairs:
/// </para>
/// <list type="number">
/// <item>Computes WhoIs hash IDs from IP + current year/month + fingerprint.</item>
/// <item>Checks for existing records in cache/database.</item>
/// <item>For misses: builds partial WhoIs and calls PopulateWhoIs to fetch external data.</item>
/// <item>Persists newly populated WhoIs records.</item>
/// <item>Returns all found records (from cache + newly created).</item>
/// </list>
/// <para>
/// If population fails for some requests, returns SOME_FOUND with partial results.
/// </para>
/// </remarks>
public class FindWhoIs : BaseHandler<FindWhoIs, I, O>, H
{
    private readonly Queries.IGetWhoIsByIdsHandler r_getWhoIsByIds;
    private readonly Queries.IGetLocationsByIdsHandler r_getLocationsByIds;
    private readonly WhoIsProvider.IPopulateHandler r_populateWhoIs;
    private readonly CreateRepo.ICreateWhoIsHandler r_createWhoIs;

    /// <summary>
    /// Initializes a new instance of the <see cref="FindWhoIs"/> class.
    /// </summary>
    ///
    /// <param name="getWhoIsByIds">
    /// The handler for getting WhoIs by their hash IDs.
    /// </param>
    /// <param name="getLocationsByIds">
    /// The handler for fetching locations by their IDs.
    /// </param>
    /// <param name="populateWhoIs">
    /// The handler for populating WhoIs records from external sources.
    /// </param>
    /// <param name="createWhoIs">
    /// The repository handler for creating WhoIs records.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public FindWhoIs(
        Queries.IGetWhoIsByIdsHandler getWhoIsByIds,
        Queries.IGetLocationsByIdsHandler getLocationsByIds,
        WhoIsProvider.IPopulateHandler populateWhoIs,
        CreateRepo.ICreateWhoIsHandler createWhoIs,
        IHandlerContext context)
        : base(context)
    {
        r_getWhoIsByIds = getWhoIsByIds;
        r_getLocationsByIds = getLocationsByIds;
        r_populateWhoIs = populateWhoIs;
        r_createWhoIs = createWhoIs;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.Request.Requests.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]), traceId: TraceId);
        }

        // Step 1: Compute WhoIs hash IDs and build partial records for all requests.
        var now = DateTime.UtcNow;
        var year = now.Year;
        var month = now.Month;

        var keyToPartialWhoIs = new Dictionary<FindWhoIsKeys, WhoIs>();
        var hashIdToKey = new Dictionary<string, FindWhoIsKeys>();
        var hashIds = new List<string>();

        foreach (var key in input.Request.Requests)
        {
            // Build partial WhoIs with just identity fields (computes hash).
            var partialWhoIs = WhoIs.Create(
                ipAddress: key.IpAddress,
                year: year,
                month: month,
                fingerprint: key.Fingerprint);

            keyToPartialWhoIs[key] = partialWhoIs;
            hashIdToKey[partialWhoIs.HashId] = key;
            hashIds.Add(partialWhoIs.HashId);
        }

        // Step 2: Check for existing WhoIs records in cache/database.
        var existingWhoIs = new Dictionary<string, WhoIsDTO>();
        var getExistingR = await r_getWhoIsByIds.HandleAsync(
            new(hashIds),
            ct);

        if (getExistingR.CheckSuccess(out var getOutput))
        {
            existingWhoIs = getOutput!.Data;
        }
        else if (getExistingR.ErrorCode == ErrorCodes.SOME_FOUND)
        {
            existingWhoIs = getOutput?.Data ?? [];
        }

        // Build result dictionary with found records.
        var results = new Dictionary<FindWhoIsKeys, WhoIsDTO>();
        foreach (var key in input.Request.Requests)
        {
            var hashId = keyToPartialWhoIs[key].HashId;
            if (existingWhoIs.TryGetValue(hashId, out var existing))
            {
                results[key] = existing;
            }
        }

        // If ALL records were found, return success.
        if (results.Count == input.Request.Requests.Count)
        {
            return D2Result<O?>.Ok(new O(results), traceId: TraceId);
        }

        // Step 3: Build partial WhoIs dictionary for missing records.
        var missingPartials = new Dictionary<string, WhoIs>();
        foreach (var key in input.Request.Requests)
        {
            if (results.ContainsKey(key))
            {
                continue;
            }

            var partialWhoIs = keyToPartialWhoIs[key];
            missingPartials[partialWhoIs.HashId] = partialWhoIs;
        }

        // Step 4: Populate missing WhoIs records from external source.
        var populateR = await r_populateWhoIs.HandleAsync(new(missingPartials), ct);
        if (populateR.CheckFailure(out var populateOutput))
        {
            Context.Logger.LogWarning(
                "Failed to populate WhoIs records. TraceId: {TraceId}. ErrorCode: {ErrorCode}",
                TraceId,
                populateR.ErrorCode);

            // Return what we have if population failed entirely.
            if (results.Count > 0)
            {
                return D2Result<O?>.SomeFound(new O(results), traceId: TraceId);
            }

            return D2Result<O?>.NotFound(traceId: TraceId);
        }

        var populatedRecords = populateOutput?.WhoIsRecords ?? [];

        // If no records were populated, return what we have.
        if (populatedRecords.Count == 0)
        {
            if (results.Count > 0)
            {
                return D2Result<O?>.SomeFound(new O(results), traceId: TraceId);
            }

            return D2Result<O?>.NotFound(traceId: TraceId);
        }

        // Step 5: Persist populated WhoIs records.
        var createWhoIsR = await r_createWhoIs.HandleAsync(
            new([.. populatedRecords.Values]),
            ct);

        if (createWhoIsR.CheckFailure(out _))
        {
            Context.Logger.LogWarning(
                "Failed to create WhoIs records. TraceId: {TraceId}. ErrorCode: {ErrorCode}",
                TraceId,
                createWhoIsR.ErrorCode);
        }

        // Step 6: Fetch locations for newly populated WhoIs records.
        var locations = await FetchLocationsAsync(populatedRecords.Values, ct);

        // Step 7: Add newly populated WhoIs to results with locations.
        foreach (var (hashId, whoIs) in populatedRecords)
        {
            if (hashIdToKey.TryGetValue(hashId, out var key))
            {
                var location = whoIs.LocationHashId is not null
                    && locations.TryGetValue(whoIs.LocationHashId, out var loc)
                        ? loc
                        : null;
                results[key] = whoIs.ToDTO(location);
            }
        }

        // Return appropriate result based on completeness.
        if (results.Count == input.Request.Requests.Count)
        {
            return D2Result<O?>.Ok(new O(results), traceId: TraceId);
        }

        return D2Result<O?>.SomeFound(new O(results), traceId: TraceId);
    }

    private async ValueTask<Dictionary<string, Location>> FetchLocationsAsync(
        IEnumerable<WhoIs> whoIsRecords,
        CancellationToken ct)
    {
        var locationHashIds = whoIsRecords
            .Where(w => w.LocationHashId is not null)
            .Select(w => w.LocationHashId!)
            .Distinct()
            .ToList();

        if (locationHashIds.Count == 0)
        {
            return [];
        }

        var locationsR = await r_getLocationsByIds.HandleAsync(
            new Queries.GetLocationsByIdsInput(locationHashIds),
            ct);

        return locationsR.Data?.Data ?? [];
    }
}
