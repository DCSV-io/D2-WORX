// -----------------------------------------------------------------------
// <copyright file="Populate.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.WhoIs.Handlers.R;

using System.Globalization;
using System.Net;
using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Geo.App.Interfaces.WhoIs;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using CreateRepo = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate;
using H = D2.Geo.App.Interfaces.WhoIs.Handlers.R.IRead.IPopulateHandler;
using I = D2.Geo.App.Interfaces.WhoIs.Handlers.R.IRead.PopulateInput;
using O = D2.Geo.App.Interfaces.WhoIs.Handlers.R.IRead.PopulateOutput;

/// <summary>
/// Handler for populating WhoIs records with data from IPinfo.io.
/// </summary>
/// <remarks>
/// Takes partial WhoIs records and populates them with ASN, location, and privacy data
/// from the IPinfo.io API. Also creates any required Location records.
/// </remarks>
public class Populate : BaseHandler<Populate, I, O>, H
{
    private readonly IIpInfoClient r_ipInfoClient;
    private readonly CreateRepo.ICreateLocationsHandler r_createLocations;

    /// <summary>
    /// Initializes a new instance of the <see cref="Populate"/> class.
    /// </summary>
    ///
    /// <param name="ipInfoClient">
    /// The IP info client for looking up IP details.
    /// </param>
    /// <param name="createLocations">
    /// The handler for creating Location records.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Populate(
        IIpInfoClient ipInfoClient,
        CreateRepo.ICreateLocationsHandler createLocations,
        IHandlerContext context)
        : base(context)
    {
        r_ipInfoClient = ipInfoClient;
        r_createLocations = createLocations;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.WhoIsRecords.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]), traceId: TraceId);
        }

        // Step 1: Fetch IP details for each record.
        var apiResults = new Dictionary<string, IpInfoResponse>();
        foreach (var (hashId, partialWhoIs) in input.WhoIsRecords)
        {
            var ipResponse = await FetchIpDetailsAsync(partialWhoIs.IPAddress, ct);
            if (ipResponse is not null)
            {
                apiResults[hashId] = ipResponse;
            }
        }

        // If no API results, return empty.
        if (apiResults.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]), traceId: TraceId);
        }

        // Step 2: Extract and dedupe locations.
        var locationsToCreate = new Dictionary<string, Location>();
        var hashIdToLocationHashId = new Dictionary<string, string?>();

        foreach (var (hashId, ipResponse) in apiResults)
        {
            var location = ExtractLocation(ipResponse);
            if (location is not null)
            {
                locationsToCreate.TryAdd(location.HashId, location);
                hashIdToLocationHashId[hashId] = location.HashId;
            }
            else
            {
                hashIdToLocationHashId[hashId] = null;
            }
        }

        // Step 3: Create locations.
        if (locationsToCreate.Count > 0)
        {
            var createLocR = await r_createLocations.HandleAsync(
                new([.. locationsToCreate.Values]),
                ct);

            if (createLocR.CheckFailure(out _))
            {
                Context.Logger.LogWarning(
                    "Failed to create locations during WhoIs population. TraceId: {TraceId}. ErrorCode: {ErrorCode}",
                    TraceId,
                    createLocR.ErrorCode);
            }
        }

        // Step 4: Build fully populated WhoIs records.
        var populatedRecords = new Dictionary<string, WhoIs>();
        foreach (var (hashId, ipResponse) in apiResults)
        {
            var partialWhoIs = input.WhoIsRecords[hashId];
            var locationHashId = hashIdToLocationHashId.GetValueOrDefault(hashId);
            var populatedWhoIs = BuildPopulatedWhoIs(partialWhoIs, ipResponse, locationHashId);
            populatedRecords[hashId] = populatedWhoIs;
        }

        return D2Result<O?>.Ok(new O(populatedRecords), traceId: TraceId);
    }

    private static Location? ExtractLocation(IpInfoResponse ipResponse)
    {
        // Check if we have any location data.
        if (string.IsNullOrWhiteSpace(ipResponse.City)
            && string.IsNullOrWhiteSpace(ipResponse.Region)
            && string.IsNullOrWhiteSpace(ipResponse.Country)
            && string.IsNullOrWhiteSpace(ipResponse.Postal)
            && string.IsNullOrWhiteSpace(ipResponse.Latitude)
            && string.IsNullOrWhiteSpace(ipResponse.Longitude))
        {
            return null;
        }

        // Parse coordinates if available.
        Coordinates? coordinates = null;
        if (!string.IsNullOrWhiteSpace(ipResponse.Latitude)
            && !string.IsNullOrWhiteSpace(ipResponse.Longitude)
            && double.TryParse(ipResponse.Latitude, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat)
            && double.TryParse(ipResponse.Longitude, NumberStyles.Float, CultureInfo.InvariantCulture, out var lon))
        {
            try
            {
                coordinates = Coordinates.Create(lat, lon);
            }
            catch
            {
                // Invalid coordinates, skip.
            }
        }

        return Location.Create(
            coordinates: coordinates,
            address: null,
            city: ipResponse.City,
            postalCode: ipResponse.Postal,
            subdivisionISO31662Code: null,
            countryISO31661Alpha2Code: ipResponse.Country);
    }

    private static WhoIs BuildPopulatedWhoIs(
        WhoIs partialWhoIs,
        IpInfoResponse ipResponse,
        string? locationHashId)
    {
        // Parse ASN from Org field (format: "AS12345 ISP Name").
        int? asn = null;
        string? asName = null;
        if (!string.IsNullOrWhiteSpace(ipResponse.Org))
        {
            var parts = ipResponse.Org.Split(' ', 2);
            if (parts.Length >= 1 && parts[0].StartsWith("AS", StringComparison.OrdinalIgnoreCase))
            {
                if (int.TryParse(parts[0][2..], out var parsedAsn))
                {
                    asn = parsedAsn;
                }
            }

            if (parts.Length >= 2)
            {
                asName = parts[1];
            }
        }

        // Build fully populated WhoIs using the factory method (preserves identity fields).
        return WhoIs.Create(
            ipAddress: partialWhoIs.IPAddress,
            year: partialWhoIs.Year,
            month: partialWhoIs.Month,
            fingerprint: partialWhoIs.Fingerprint,
            asn: asn,
            asName: asName,
            asDomain: null,
            asType: null,
            carrierName: null,
            mcc: null,
            mnc: null,
            asChanged: null,
            geoChanged: null,
            isAnonymous: ipResponse.Privacy?.Relay,
            isAnycast: null,
            isHosting: ipResponse.Privacy?.Hosting,
            isMobile: null,
            isSatellite: null,
            isProxy: ipResponse.Privacy?.Proxy,
            isRelay: ipResponse.Privacy?.Relay,
            isTor: ipResponse.Privacy?.Tor,
            isVpn: ipResponse.Privacy?.Vpn,
            privacyName: null,
            locationHashId: locationHashId);
    }

    private async Task<IpInfoResponse?> FetchIpDetailsAsync(
        string ipAddress,
        CancellationToken ct)
    {
        // Validate IP address.
        if (string.IsNullOrWhiteSpace(ipAddress))
        {
            return null;
        }

        if (!IPAddress.TryParse(ipAddress, out var ip))
        {
            Context.Logger.LogWarning("Invalid IP address: {IpAddress}", ipAddress);
            return null;
        }

        // Skip localhost.
        var ipStr = ip.ToString();
        if (ipStr is "127.0.0.1" or "::1")
        {
            Context.Logger.LogDebug("Skipping localhost IP address");
            return null;
        }

        return await r_ipInfoClient.GetDetailsAsync(ipStr, ct);
    }
}
